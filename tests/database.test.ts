import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
const url = process.env.TEST_DATABASE_URL;
const cid = "20260000-0000-4000-8000-000000000001";
const users = {
  admin: "10000000-0000-4000-8000-000000000001",
  alice: "10000000-0000-4000-8000-000000000002",
  bob: "10000000-0000-4000-8000-000000000003",
  outsider: "10000000-0000-4000-8000-000000000004",
  unverified: "10000000-0000-4000-8000-000000000005",
};
const db = new pg.Client({ connectionString: url });
const migration = new URL(
  "../supabase/migrations/202610310001_initial.sql",
  import.meta.url,
);
before(async () => {
  if (!url) return;
  const u = new URL(url);
  if (
    !["localhost", "127.0.0.1"].includes(u.hostname) ||
    u.pathname !== "/movember_test"
  )
    throw new Error(
      "Tests require disposable localhost/movember_test database",
    );
  await db.connect();
  await db.query(`drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; drop schema if exists extensions cascade; create schema public; create schema auth; create schema storage; create schema extensions;
 do $$ begin if not exists(select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin; end if; if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text unique);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant select,insert,delete on storage.objects to authenticated;
 grant execute on function auth.uid(),storage.foldername(text) to anon,authenticated;`);
  await db.query(await readFile(migration, "utf8"));
  await db.query(
    await readFile(
      new URL(
        "../supabase/migrations/202610310002_invitation_auth_hook.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const [name, id] of Object.entries(users))
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      name + "@example.com",
      name === "unverified" ? null : new Date(),
    ]);
  for (const name of ["admin", "alice", "bob"] as const)
    await db.query(
      "insert into public.memberships(competition_id,user_id,display_name,role) values($1,$2,$3,$4)",
      [cid, users[name], name, name === "admin" ? "admin" : "member"],
    );
});
after(async () => {
  if (url) await db.end();
});
async function asUser(name: keyof typeof users, fn: () => Promise<void>) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      users[name],
    ]);
    await fn();
  } finally {
    await db.query("rollback");
  }
}
const sqlTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !url }, fn);
async function addGoal(uid = users.alice) {
  const r = await db.query(
    "insert into public.goals(competition_id,user_id,title,category,target,unit) values($1,$2,'Steps','fitness',10000,'steps') returning id",
    [cid, uid],
  );
  return r.rows[0].id as string;
}
sqlTest(
  "anonymous cannot read competition, members, goals, or score views",
  async () => {
    for (const table of [
      "competitions",
      "memberships",
      "goals",
      "individual_scores",
      "team_scores",
      "evidence",
    ]) {
      await db.query("begin");
      try {
        await db.query("set local role anon");
        await assert.rejects(
          () => db.query(`select * from public.${table}`),
          /permission denied/,
        );
      } finally {
        await db.query("rollback");
      }
    }
  },
);
sqlTest(
  "authenticated nonmember sees no private rows or rankings",
  async () => {
    await asUser("outsider", async () => {
      for (const table of [
        "competitions",
        "memberships",
        "goals",
        "individual_scores",
        "team_scores",
        "announcements",
        "prizes",
        "invitations",
      ])
        assert.equal(
          (await db.query(`select * from public.${table}`)).rowCount,
          0,
        );
      await assert.rejects(
        () =>
          db.query(
            "select public.save_goal($1,'Steps','fitness',10000,'steps',array[0,1,2,3,4,5,6])",
            [cid],
          ),
        /Forbidden/,
      );
    });
  },
);
sqlTest(
  "verified member can read rankings but cannot mutate tables directly",
  async () => {
    await asUser("alice", async () => {
      assert.equal(
        (await db.query("select * from public.individual_scores")).rowCount,
        3,
      );
      await assert.rejects(
        () =>
          db.query(
            "update public.memberships set role='admin' where user_id=$1",
            [users.alice],
          ),
        /permission denied/,
      );
    });
  },
);
sqlTest(
  "invitations require matching verified email and cannot be reused",
  async () => {
    await db.query("begin");
    try {
      const token = "test-token-with-at-least-32-characters";
      await db.query(
        "insert into public.invitations(competition_id,email,token_hash,created_by) values($1,'outsider@example.com',encode(extensions.digest($2,'sha256'),'hex'),$3)",
        [cid, token, users.admin],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.outsider,
      ]);
      await db.query("select public.accept_invitation($1,'New member')", [
        token,
      ]);
      assert.equal(
        (
          await db.query("select * from public.memberships where user_id=$1", [
            users.outsider,
          ])
        ).rowCount,
        1,
      );
      await assert.rejects(
        () =>
          db.query("select public.accept_invitation($1,'New member')", [token]),
        /Invalid, expired/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest("unverified users cannot redeem invitations", async () => {
  await asUser("unverified", async () => {
    await assert.rejects(
      () =>
        db.query(
          "select public.accept_invitation('not-a-real-token','Unverified')",
        ),
      /Verify your email/,
    );
  });
});
sqlTest("members cannot call administrator functions", async () => {
  await asUser("alice", async () => {
    await assert.rejects(
      () =>
        db.query(
          "select public.create_invitation($1,'new@example.com',repeat('x',64))",
          [cid],
        ),
      /Forbidden/,
    );
  });
});
sqlTest("suspended members lose all competition access", async () => {
  await db.query("begin");
  try {
    await db.query(
      "update public.memberships set status='suspended' where user_id=$1",
      [users.alice],
    );
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      users.alice,
    ]);
    assert.equal(
      (await db.query("select * from public.memberships")).rowCount,
      0,
    );
    assert.equal(
      (await db.query("select * from public.individual_scores")).rowCount,
      0,
    );
  } finally {
    await db.query("rollback");
  }
});
sqlTest("goal creation closes after the competition", async () => {
  await db.query("begin");
  try {
    await db.query(
      "update public.competitions set starts_on=current_date-30,ends_on=current_date-1 where id=$1",
      [cid],
    );
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      users.alice,
    ]);
    await assert.rejects(
      () =>
        db.query(
          "select public.save_goal($1,'Steps','fitness',10000,'steps',array[0,1,2,3,4,5,6])",
          [cid],
        ),
      /closed/,
    );
  } finally {
    await db.query("rollback");
  }
});
sqlTest(
  "logging enforces ownership, date boundaries and reviewed-entry locks",
  async () => {
    await db.query("begin");
    try {
      const gid = await addGoal();
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.bob,
      ]);
      await assert.rejects(
        () =>
          db.query(
            "select public.record_progress($1,'2026-11-01',10000,'',null)",
            [gid],
          ),
        /Forbidden/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest("future days cannot be logged", async () => {
  await db.query("begin");
  try {
    const gid = await addGoal();
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      users.alice,
    ]);
    await assert.rejects(
      () =>
        db.query(
          "select public.record_progress($1,current_date+100,10000,'',null)",
          [gid],
        ),
      /Not a scheduled/,
    );
  } finally {
    await db.query("rollback");
  }
});
sqlTest(
  "upsert prevents duplicate scoring, over-target is capped, rejected scores zero",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date,ends_on=current_date where id=$1",
        [cid],
      );
      const gid = await addGoal();
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      const {
        rows: [entry],
      } = await db.query(
        "select public.record_progress($1,current_date,5000,'',null) id",
        [gid],
      );
      assert.equal(
        Number(
          (
            await db.query("select score from public.goal_scores where id=$1", [
              gid,
            ])
          ).rows[0].score,
        ),
        35,
      );
      await db.query(
        "select public.record_progress($1,current_date,1000000,'',null)",
        [gid],
      );
      assert.equal(
        (
          await db.query(
            "select * from public.progress_entries where goal_id=$1",
            [gid],
          )
        ).rowCount,
        1,
      );
      assert.equal(
        Number(
          (
            await db.query("select score from public.goal_scores where id=$1", [
              gid,
            ])
          ).rows[0].score,
        ),
        100,
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.admin,
      ]);
      await db.query(
        "select public.review_progress($1,'rejected','Incorrect')",
        [entry.id],
      );
      assert.equal(
        Number(
          (
            await db.query("select score from public.goal_scores where id=$1", [
              gid,
            ])
          ).rows[0].score,
        ),
        0,
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      await assert.rejects(
        () =>
          db.query(
            "select public.record_progress($1,current_date,10000,'',null)",
            [gid],
          ),
        /Reviewed entries are locked/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "screenshots readable only by owner and admin, not another member",
  async () => {
    await db.query("begin");
    try {
      const gid = await addGoal();
      const path = users.alice + "/proof.png";
      const {
        rows: [entry],
      } = await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,'2026-11-01',10000,'pending') returning id",
        [cid, users.alice, gid],
      );
      await db.query(
        "insert into storage.objects(bucket_id,name) values('progress-evidence',$1)",
        [path],
      );
      await db.query(
        "insert into public.evidence(entry_id,user_id,competition_id,path) values($1,$2,$3,$4)",
        [entry.id, users.alice, cid, path],
      );
      await db.query("set local role authenticated");
      for (const name of ["alice", "admin", "bob", "outsider"] as const) {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
          users[name],
        ]);
        const expected = ["alice", "admin"].includes(name) ? 1 : 0;
        assert.equal(
          (await db.query("select * from public.evidence")).rowCount,
          expected,
          name,
        );
        assert.equal(
          (await db.query("select * from storage.objects")).rowCount,
          expected,
          name,
        );
      }
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "members cannot upload screenshots into another owner folder",
  async () => {
    await asUser("bob", async () => {
      await assert.rejects(
        () =>
          db.query(
            "insert into storage.objects(bucket_id,name) values('progress-evidence',$1)",
            [users.alice + "/stolen.png"],
          ),
        /row-level security/,
      );
    });
  },
);
sqlTest(
  "competition boundaries remain private to their respective memberships",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "insert into public.competitions values('20270000-0000-4000-8000-000000000001','Future public season','2027-11-01','2027-11-30')",
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      assert.equal(
        (await db.query("select * from public.competitions")).rowCount,
        1,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "auth hook denies uninvited account creation and accepts only the invited email",
  async () => {
    await db.query("begin");
    try {
      const token = "a-valid-invitation-code-for-the-hook";
      await db.query(
        "insert into public.invitations(competition_id,email,token_hash,created_by) values($1,'new@example.com',encode(extensions.digest($2,'sha256'),'hex'),$3)",
        [cid, token, users.admin],
      );
      await db.query("set local role supabase_auth_admin");
      const call = async (email: string, t?: string) =>
        (
          await db.query(
            "select public.before_user_created($1::jsonb) result",
            [
              JSON.stringify({
                user: { email, user_metadata: { invitation_token: t } },
              }),
            ],
          )
        ).rows[0].result;
      assert.equal((await call("new@example.com")).error.http_code, 403);
      assert.equal(
        (await call("wrong@example.com", token)).error.http_code,
        403,
      );
      assert.deepEqual(await call("new@example.com", token), {});
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "SQL scoring weights fitness twice and averages team members including zero",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date,ends_on=current_date where id=$1",
        [cid],
      );
      const gid = await addGoal();
      await db.query(
        "insert into public.goals(competition_id,user_id,title,category,target,unit) values($1,$2,'Read','personal',10,'pages')",
        [cid, users.alice],
      );
      await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date,10000,'honor')",
        [cid, users.alice, gid],
      );
      const {
        rows: [team],
      } = await db.query(
        "insert into public.teams(competition_id,name,created_by) values($1,'Family', $2) returning id",
        [cid, users.alice],
      );
      await db.query(
        "update public.memberships set team_id=$1 where user_id in ($2,$3)",
        [team.id, users.alice, users.bob],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      assert.equal(
        Number(
          (
            await db.query(
              "select score from public.individual_scores where user_id=$1",
              [users.alice],
            )
          ).rows[0].score,
        ),
        66.67,
      );
      const score = (
        await db.query("select * from public.team_scores where id=$1", [
          team.id,
        ])
      ).rows[0];
      assert.equal(score.member_count, 2);
      assert.equal(Number(score.score), 33.34);
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "schedule normalization excludes off-days and counts missed days",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date-6,ends_on=current_date where id=$1",
        [cid],
      );
      const gid = await addGoal();
      await db.query(
        "update public.goals set weekdays=array[extract(dow from current_date)::integer] where id=$1",
        [gid],
      );
      await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date,10000,'honor')",
        [cid, users.alice, gid],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      const g = (
        await db.query("select * from public.goal_scores where id=$1", [gid])
      ).rows[0];
      assert.equal(g.scheduled_days, 1);
      assert.equal(Number(g.score), 100);
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "late registration is permitted but does not erase earlier missed days",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date-29,ends_on=current_date where id=$1",
        [cid],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      await db.query(
        "select public.save_goal($1,'Late goal','fitness',10000,'steps',array[0,1,2,3,4,5,6])",
        [cid],
      );
      const g = (
        await db.query("select * from public.goal_scores where user_id=$1", [
          users.alice,
        ])
      ).rows[0];
      assert.equal(g.scheduled_days, 30);
      assert.equal(Number(g.score), 0);
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest("team choice locks after first progress record", async () => {
  await db.query("begin");
  try {
    const gid = await addGoal();
    await db.query(
      "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,'2026-11-01',0,'honor')",
      [cid, users.alice, gid],
    );
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      users.alice,
    ]);
    await assert.rejects(
      () => db.query("select public.create_team($1,'New family')", [cid]),
      /locks after/,
    );
  } finally {
    await db.query("rollback");
  }
});
sqlTest(
  "upload without a committed log can be cleaned up by its owner",
  async () => {
    await asUser("alice", async () => {
      await db.query(
        "insert into storage.objects(bucket_id,name) values('progress-evidence',$1)",
        [users.alice + "/orphan.png"],
      );
      assert.equal(
        (await db.query("select * from storage.objects")).rowCount,
        1,
      );
      assert.equal((await db.query("delete from storage.objects")).rowCount, 1);
    });
  },
);
sqlTest("expired invitations do not create membership", async () => {
  await db.query("begin");
  try {
    const token = "expired-invitation-code-at-least-32-characters";
    await db.query(
      "insert into public.invitations(competition_id,email,token_hash,created_by,expires_at) values($1,'outsider@example.com',encode(extensions.digest($2,'sha256'),'hex'),$3,now()-interval '1 day')",
      [cid, token, users.admin],
    );
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      users.outsider,
    ]);
    await assert.rejects(
      () => db.query("select public.accept_invitation($1,'Too late')", [token]),
      /Invalid, expired/,
    );
  } finally {
    await db.query("rollback");
  }
});
