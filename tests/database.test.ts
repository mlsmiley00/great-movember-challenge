import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text unique);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant select,insert,delete on storage.objects to authenticated;
 grant execute on function auth.uid(),storage.foldername(text) to anon,authenticated;`);
  const migrationsDirectory = new URL(
    "../supabase/migrations/",
    import.meta.url,
  );
  for (const filename of (await readdir(migrationsDirectory))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (filename === "202611060002_honor_system_default.sql") {
      await db.query(`
        insert into auth.users(id,email,email_confirmed_at) values('90000000-0000-4000-8000-000000000001','migration@example.com',now());
        insert into public.memberships(competition_id,user_id,display_name) values('${cid}','90000000-0000-4000-8000-000000000001','Migration fixture');
        insert into public.goals(id,competition_id,user_id,title,category,target,unit) values('90000000-0000-4000-8000-000000000002','${cid}','90000000-0000-4000-8000-000000000001','Migration goal','fitness',10000,'steps');
        insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,notes,verification)
        select '${cid}','90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','2026-11-01'::date + n,10000,status,status
        from (values (0,'pending'),(1,'verified'),(2,'rejected')) as fixture(n,status);
      `);
    }
    await db.query(
      await readFile(new URL(filename, migrationsDirectory), "utf8"),
    );
    if (filename === "202611060002_honor_system_default.sql") {
      assert.deepEqual(
        (
          await db.query(
            "select notes,verification from public.progress_entries where goal_id='90000000-0000-4000-8000-000000000002' order by logged_on",
          )
        ).rows,
        [
          { notes: "pending", verification: "honor" },
          { notes: "verified", verification: "verified" },
          { notes: "rejected", verification: "rejected" },
        ],
      );
      await db.query(`delete from public.progress_entries where goal_id='90000000-0000-4000-8000-000000000002';
        delete from public.goals where id='90000000-0000-4000-8000-000000000002';
        delete from public.memberships where user_id='90000000-0000-4000-8000-000000000001';
        delete from auth.users where id='90000000-0000-4000-8000-000000000001';`);
    }
  }
  for (const [name, id] of Object.entries(users))
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)",
      [id, name + "@example.com", name === "unverified" ? null : new Date()],
    );
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
sqlTest(
  "members can create, switch and leave teams after logging without losing progress",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date,ends_on=current_date where id=$1",
        [cid],
      );
      const gid = await addGoal();
      await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date,10000,'honor')",
        [cid, users.alice, gid],
      );
      const {
        rows: [other],
      } = await db.query(
        "insert into public.teams(competition_id,name,created_by) values($1,'Other family',$2) returning id",
        [cid, users.bob],
      );
      await db.query(
        "update public.memberships set team_id=$1 where user_id=$2",
        [other.id, users.bob],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      await db.query("select public.create_team($1,'My new family')", [cid]);
      const teamId = (
        await db.query(
          "select team_id from public.memberships where user_id=$1",
          [users.alice],
        )
      ).rows[0].team_id;
      assert.ok(teamId);
      assert.equal(
        Number(
          (
            await db.query("select score from public.team_scores where id=$1", [
              teamId,
            ])
          ).rows[0].score,
        ),
        100,
      );
      await db.query("select public.join_team($1,$2)", [cid, other.id]);
      const joined = (
        await db.query("select * from public.team_scores where id=$1", [
          other.id,
        ])
      ).rows[0];
      assert.equal(joined.member_count, 2);
      assert.equal(Number(joined.score), 50);
      assert.equal(
        (
          await db.query(
            "select member_count from public.team_scores where id=$1",
            [teamId],
          )
        ).rows[0].member_count,
        0,
      );
      await db.query("select public.join_team($1,null)", [cid]);
      assert.equal(
        (
          await db.query(
            "select team_id from public.memberships where user_id=$1",
            [users.alice],
          )
        ).rows[0].team_id,
        null,
      );
      assert.equal(
        (
          await db.query(
            "select member_count from public.team_scores where id=$1",
            [other.id],
          )
        ).rows[0].member_count,
        1,
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
            await db.query(
              "select score from public.individual_scores where user_id=$1",
              [users.alice],
            )
          ).rows[0].score,
        ),
        100,
      );
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest("nonmembers still cannot change team membership", async () => {
  await asUser("outsider", async () => {
    await assert.rejects(
      () => db.query("select public.join_team($1,null)", [cid]),
      /Forbidden/,
    );
  });
});
sqlTest("members cannot join another competition's team", async () => {
  await db.query("begin");
  try {
    await db.query(
      "update public.competitions set starts_on=current_date,ends_on=current_date where id=$1",
      [cid],
    );
    const otherCid = "20270000-0000-4000-8000-000000000001";
    await db.query(
      "insert into public.competitions values($1,'Another competition',current_date,current_date)",
      [otherCid],
    );
    const {
      rows: [other],
    } = await db.query(
      "insert into public.teams(competition_id,name,created_by) values($1,'Other season',$2) returning id",
      [otherCid, users.bob],
    );
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      users.alice,
    ]);
    await assert.rejects(
      () => db.query("select public.join_team($1,$2)", [cid, other.id]),
      /Invalid team/,
    );
  } finally {
    await db.query("rollback");
  }
});
sqlTest("team changes still close after the competition ends", async () => {
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
      () => db.query("select public.join_team($1,null)", [cid]),
      /Team registration is closed/,
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
sqlTest(
  "display name changes update only the caller and preserve membership settings and progress",
  async () => {
    await db.query("begin");
    try {
      const gid = await addGoal();
      await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,'2026-11-01',10000,'honor')",
        [cid, users.alice, gid],
      );
      const {
        rows: [before],
      } = await db.query(
        "select * from public.memberships where competition_id=$1 and user_id=$2",
        [cid, users.alice],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      await db.query(
        "select public.update_display_name($1,'  María   López  ')",
        [cid],
      );
      const {
        rows: [after],
      } = await db.query(
        "select * from public.memberships where competition_id=$1 and user_id=$2",
        [cid, users.alice],
      );
      assert.equal(after.display_name, "María López");
      assert.deepEqual({ ...after, display_name: before.display_name }, before);
      assert.equal(
        (
          await db.query(
            "select display_name from public.individual_scores where user_id=$1",
            [users.alice],
          )
        ).rows[0].display_name,
        "María López",
      );
      assert.equal(
        (
          await db.query(
            "select display_name from public.memberships where user_id=$1",
            [users.bob],
          )
        ).rows[0].display_name,
        "bob",
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
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "display name updates reject blank, too short, too long, and null names",
  async () => {
    for (const name of ["", " ", "\t\n", "A", "x".repeat(61), null]) {
      await asUser("alice", async () => {
        await assert.rejects(
          () =>
            db.query("select public.update_display_name($1,$2)", [cid, name]),
          /2 to 60/,
        );
      });
    }
  },
);
sqlTest(
  "display name updates allow the maximum length and do not require unique names",
  async () => {
    await asUser("alice", async () => {
      await db.query("select public.update_display_name($1,$2)", [
        cid,
        "x".repeat(60),
      ]);
      assert.equal(
        (
          await db.query(
            "select display_name from public.memberships where user_id=$1",
            [users.alice],
          )
        ).rows[0].display_name.length,
        60,
      );
      await db.query("select public.update_display_name($1,'bob')", [cid]);
      assert.equal(
        (
          await db.query(
            "select * from public.memberships where display_name='bob'",
          )
        ).rowCount,
        2,
      );
    });
  },
);
sqlTest(
  "nonmembers and unverified accounts cannot change display names",
  async () => {
    for (const name of ["outsider", "unverified"] as const)
      await asUser(name, async () => {
        await assert.rejects(
          () =>
            db.query("select public.update_display_name($1,'New name')", [cid]),
          /Forbidden/,
        );
      });
  },
);
sqlTest("suspended members cannot change display names", async () => {
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
    await assert.rejects(
      () => db.query("select public.update_display_name($1,'New name')", [cid]),
      /Forbidden/,
    );
  } finally {
    await db.query("rollback");
  }
});
sqlTest("anonymous users cannot call the display name function", async () => {
  await db.query("begin");
  try {
    await db.query("set local role anon");
    await assert.rejects(
      () => db.query("select public.update_display_name($1,'New name')", [cid]),
      /permission denied/,
    );
  } finally {
    await db.query("rollback");
  }
});
sqlTest(
  "display name changes do not modify another season membership",
  async () => {
    await db.query("begin");
    try {
      const otherCid = "20270000-0000-4000-8000-000000000001";
      await db.query(
        "insert into public.competitions values($1,'Future season','2027-11-01','2027-11-30')",
        [otherCid],
      );
      await db.query(
        "insert into public.memberships(competition_id,user_id,display_name) values($1,$2,'Future name')",
        [otherCid, users.alice],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      await db.query("select public.update_display_name($1,'Current name')", [
        cid,
      ]);
      assert.equal(
        (
          await db.query(
            "select display_name from public.memberships where competition_id=$1 and user_id=$2",
            [otherCid, users.alice],
          )
        ).rows[0].display_name,
        "Future name",
      );
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "active members can browse another member’s goals and schedules within their competition",
  async () => {
    await db.query("begin");
    try {
      const gid = await addGoal(users.bob);
      await db.query(
        "update public.goals set weekdays=array[1,3,5] where id=$1",
        [gid],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      const {
        rows: [goal],
      } = await db.query("select * from public.goal_scores where id=$1", [gid]);
      assert.equal(goal.user_id, users.bob);
      assert.equal(goal.title, "Steps");
      assert.equal(Number(goal.target), 10000);
      assert.deepEqual(goal.weekdays, [1, 3, 5]);
      assert.equal(
        (
          await db.query(
            "select display_name from public.memberships where user_id=$1",
            [users.bob],
          )
        ).rows[0].display_name,
        "bob",
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "members can catch up on scheduled past days, including before their goal was created",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date-40,ends_on=current_date+3 where id=$1",
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
        "select public.record_progress($1,current_date-7,7000,'Catching up',null,'America/Chicago') as id",
        [gid],
      );
      const {
        rows: [saved],
      } = await db.query(
        "select notes,value,logged_on::text from public.progress_entries where id=$1",
        [entry.id],
      );
      assert.equal(saved.notes, "Catching up");
      assert.equal(Number(saved.value), 7000);
      await db.query(
        "select public.record_progress($1,current_date-7,8000,'Corrected',null,'America/Chicago')",
        [gid],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.progress_entries where goal_id=$1",
            [gid],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        Number(
          (
            await db.query(
              "select value from public.progress_entries where id=$1",
              [entry.id],
            )
          ).rows[0].value,
        ),
        8000,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "reporting timezone accepts local today and rejects local tomorrow, invalid zones, and unscheduled days",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date-40,ends_on=current_date+3 where id=$1",
        [cid],
      );
      const gid = await addGoal();
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      for (const zone of [
        "America/Chicago",
        "Pacific/Kiritimati",
        "Pacific/Honolulu",
      ]) {
        await db.query(
          "select public.record_progress($1,(now() at time zone $2)::date,10000,'',null,$2)",
          [gid, zone],
        );
        await db.query("savepoint future_day");
        await assert.rejects(
          () =>
            db.query(
              "select public.record_progress($1,(now() at time zone $2)::date+1,10000,'',null,$2)",
              [gid, zone],
            ),
          /Not a scheduled/,
        );
        await db.query("rollback to savepoint future_day");
      }
      await db.query("savepoint invalid_zone");
      await assert.rejects(
        () =>
          db.query(
            "select public.record_progress($1,current_date,10000,'',null,'not-a-timezone')",
            [gid],
          ),
        /Invalid reporting timezone/,
      );
      await db.query("rollback to savepoint invalid_zone");
      await db.query("reset role");
      await db.query(
        "update public.goals set weekdays=array[((extract(dow from current_date)::int+1)%7)] where id=$1",
        [gid],
      );
      await db.query("set local role authenticated");
      await assert.rejects(
        () =>
          db.query(
            "select public.record_progress($1,current_date,10000,'',null,'UTC')",
            [gid],
          ),
        /Not a scheduled/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "catch-up retains competition boundaries, reporting deadline, and reviewed-entry locks",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date-40,ends_on=current_date+3 where id=$1",
        [cid],
      );
      const gid = await addGoal();
      await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date-7,10000,'verified')",
        [cid, users.alice, gid],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      for (const [expression, error] of [
        ["current_date-7", /Reviewed entries/],
        ["current_date-41", /Not a scheduled/],
      ] as const) {
        await db.query("savepoint invalid_day");
        await assert.rejects(
          () =>
            db.query(
              `select public.record_progress($1,${expression},10000,'',null,'UTC')`,
              [gid],
            ),
          error,
        );
        await db.query("rollback to savepoint invalid_day");
      }
      await db.query("reset role");
      await db.query(
        "update public.competitions set ends_on=current_date-3 where id=$1",
        [cid],
      );
      await db.query("set local role authenticated");
      await assert.rejects(
        () =>
          db.query(
            "select public.record_progress($1,current_date-4,10000,'',null,'UTC')",
            [gid],
          ),
        /Reporting is closed/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "goal removal deletes only the owner's goal and linked records, recalculates scores, and permits orphan screenshot cleanup",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date,ends_on=current_date where id=$1",
        [cid],
      );
      const gid = await addGoal();
      const other = await addGoal(users.bob);
      const {
        rows: [entry],
      } = await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date,10000,'verified') returning id",
        [cid, users.alice, gid],
      );
      const path = users.alice + "/accidental.png";
      await db.query(
        "insert into storage.objects(bucket_id,name) values('progress-evidence',$1)",
        [path],
      );
      await db.query(
        "insert into public.evidence(entry_id,user_id,competition_id,path) values($1,$2,$3,$4)",
        [entry.id, users.alice, cid, path],
      );
      await db.query(
        "insert into public.comments(competition_id,entry_id,user_id,body) values($1,$2,$3,'Well done')",
        [cid, entry.id, users.bob],
      );
      await db.query(
        "insert into public.reactions(competition_id,entry_id,user_id) values($1,$2,$3)",
        [cid, entry.id, users.bob],
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
        100,
      );
      const {
        rows: [removed],
      } = await db.query("select public.remove_own_goal($1) as paths", [gid]);
      assert.deepEqual(removed.paths, [path]);
      for (const table of [
        "progress_entries",
        "evidence",
        "comments",
        "reactions",
      ]) {
        const column = table === "progress_entries" ? "id" : "entry_id";
        assert.equal(
          (
            await db.query(
              `select count(*)::int as n from public.${table} where ${column}=$1`,
              [entry.id],
            )
          ).rows[0].n,
          0,
        );
      }
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.goals where id=$1",
            [gid],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.goals where id=$1",
            [other],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        Number(
          (
            await db.query(
              "select score from public.individual_scores where user_id=$1",
              [users.alice],
            )
          ).rows[0].score,
        ),
        0,
      );
      assert.equal(
        (await db.query("delete from storage.objects where name=$1", [path]))
          .rowCount,
        1,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "goal removal rejects another owner's goal, suspended members, and anonymous users",
  async () => {
    await db.query("begin");
    try {
      const gid = await addGoal();
      for (const name of ["bob", "outsider", "admin"] as const) {
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
          users[name],
        ]);
        await db.query("savepoint forbidden");
        await assert.rejects(
          () => db.query("select public.remove_own_goal($1)", [gid]),
          /Forbidden/,
        );
        await db.query("rollback to savepoint forbidden");
        await db.query("reset role");
      }
      await db.query(
        "update public.memberships set status='suspended' where user_id=$1",
        [users.alice],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      await db.query("savepoint suspended");
      await assert.rejects(
        () => db.query("select public.remove_own_goal($1)", [gid]),
        /Forbidden/,
      );
      await db.query("rollback to savepoint suspended");
      await db.query("reset role");
      await db.query("set local role anon");
      await assert.rejects(
        () => db.query("select public.remove_own_goal($1)", [gid]),
        /permission denied/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "honor is the default with and without screenshots, including updates",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date,ends_on=current_date where id=$1",
        [cid],
      );
      assert.equal(
        (
          await db.query(
            "select require_progress_review from public.competitions where id=$1",
            [cid],
          )
        ).rows[0].require_progress_review,
        false,
      );
      const gid = await addGoal();
      const path = users.alice + "/honor-proof.png";
      await db.query(
        "insert into storage.objects(bucket_id,name) values('progress-evidence',$1)",
        [path],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      for (const screenshot of [null, path, null]) {
        const {
          rows: [entry],
        } = await db.query(
          "select public.record_progress($1,current_date,10000,'', $2,'UTC') as id",
          [gid, screenshot],
        );
        assert.equal(
          (
            await db.query(
              "select verification from public.progress_entries where id=$1",
              [entry.id],
            )
          ).rows[0].verification,
          "honor",
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int as n from public.evidence where entry_id=$1",
              [entry.id],
            )
          ).rows[0].n,
          screenshot ? 1 : 0,
        );
      }
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "admins can require review for all new reports and turn it off to release pending entries",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date-3,ends_on=current_date where id=$1",
        [cid],
      );
      const gid = await addGoal();
      const other = await addGoal();
      const path = users.alice + "/required-proof.png";
      await db.query(
        "insert into storage.objects(bucket_id,name) values('progress-evidence',$1)",
        [path],
      );
      await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date-1,10000,'verified'),($1,$2,$3,current_date-2,10000,'rejected'),($1,$2,$3,current_date-3,10000,'honor')",
        [cid, users.alice, gid],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.admin,
      ]);
      await db.query("select public.set_progress_review($1,true)", [cid]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      for (const [goal, screenshot] of [
        [gid, null],
        [other, path],
      ] as const) {
        const {
          rows: [entry],
        } = await db.query(
          "select public.record_progress($1,current_date,10000,'', $2) as id",
          [goal, screenshot],
        );
        assert.equal(
          (
            await db.query(
              "select verification from public.progress_entries where id=$1",
              [entry.id],
            )
          ).rows[0].verification,
          "pending",
        );
      }
      await db.query(
        "select public.record_progress($1,current_date-3,10000,'updated',null,'UTC')",
        [gid],
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.admin,
      ]);
      await db.query("select public.set_progress_review($1,false)", [cid]);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.progress_entries where verification='pending'",
          )
        ).rows[0].n,
        0,
      );
      const {
        rows: [counts],
      } = await db.query(
        "select count(*) filter(where verification='honor')::int as honor,count(*) filter(where verification='verified')::int as verified,count(*) filter(where verification='rejected')::int as rejected from public.progress_entries where goal_id in ($1,$2)",
        [gid, other],
      );
      assert.deepEqual(counts, { honor: 3, verified: 1, rejected: 1 });
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.evidence where path=$1",
            [path],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "review mode is admin-only and cannot be changed directly by a member",
  async () => {
    await asUser("alice", async () => {
      for (const statement of [
        "select public.set_progress_review('" + cid + "',true)",
        "update public.competitions set require_progress_review=true where id='" +
          cid +
          "'",
      ]) {
        await db.query("savepoint forbidden");
        await assert.rejects(
          () => db.query(statement),
          /Forbidden|permission denied/,
        );
        await db.query("rollback to savepoint forbidden");
      }
    });
    await asUser("outsider", async () => {
      await assert.rejects(
        () => db.query("select public.set_progress_review($1,true)", [cid]),
        /Forbidden/,
      );
    });
    await db.query("begin");
    try {
      await db.query("set local role anon");
      await assert.rejects(
        () => db.query("select public.set_progress_review($1,true)", [cid]),
        /permission denied/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "public registration is closed by default and exposes only its availability to anonymous visitors",
  async () => {
    await db.query("begin");
    try {
      await db.query("set local role anon");
      assert.equal(
        (await db.query("select public.public_registration_open() as open"))
          .rows[0].open,
        false,
      );
      await assert.rejects(
        () => db.query("select public.join_public_competition('Visitor',true)"),
        /permission denied/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "open signup hook requires a name and explicit consent instead of an invitation",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set public_registration_enabled=true where id=$1",
        [cid],
      );
      for (const metadata of [
        {},
        { display_name: "A", club_consent: true },
        { display_name: "Person", club_consent: "true" },
        { display_name: "Person", club_consent: false },
      ]) {
        const {
          rows: [result],
        } = await db.query(
          "select public.before_user_created($1::jsonb) as result",
          [
            JSON.stringify({
              user: { email: "new@example.test", user_metadata: metadata },
            }),
          ],
        );
        assert.equal(result.result.error.http_code, 403);
      }
      const {
        rows: [result],
      } = await db.query(
        "select public.before_user_created($1::jsonb) as result",
        [
          JSON.stringify({
            user: {
              email: "new@example.test",
              user_metadata: {
                display_name: "New member",
                club_consent: true,
                role: "admin",
              },
            },
          }),
        ],
      );
      assert.deepEqual(result.result, {});
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "email verification automatically grants ordinary membership, never metadata-supplied privileges",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set public_registration_enabled=true where id=$1",
        [cid],
      );
      const uid = "70000000-0000-4000-8000-000000000001";
      await db.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,'new@example.test',$2::jsonb)",
        [
          uid,
          JSON.stringify({
            display_name: "  New   member  ",
            club_consent: true,
            role: "admin",
            status: "active",
            competition_id: "forged",
          }),
        ],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.memberships where user_id=$1",
            [uid],
          )
        ).rows[0].n,
        0,
      );
      await db.query(
        "update auth.users set email_confirmed_at=now() where id=$1",
        [uid],
      );
      assert.deepEqual(
        (
          await db.query(
            "select competition_id,display_name,role,status from public.memberships where user_id=$1",
            [uid],
          )
        ).rows,
        [
          {
            competition_id: cid,
            display_name: "New member",
            role: "member",
            status: "active",
          },
        ],
      );
      await db.query(
        "update auth.users set email_confirmed_at=now() where id=$1",
        [uid],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.memberships where user_id=$1",
            [uid],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "verified legacy accounts can join without invitations but unverified users cannot",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set public_registration_enabled=true where id=$1",
        [cid],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.unverified,
      ]);
      await db.query("savepoint unverified");
      await assert.rejects(
        () =>
          db.query("select public.join_public_competition('Unverified',true)"),
        /Verify your email/,
      );
      await db.query("rollback to savepoint unverified");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.outsider,
      ]);
      await db.query("savepoint consent");
      await assert.rejects(
        () =>
          db.query("select public.join_public_competition('New member',false)"),
        /consent required/,
      );
      await db.query("rollback to savepoint consent");
      await db.query(
        "select public.join_public_competition('New member',true)",
      );
      await db.query(
        "select public.join_public_competition('New member',true)",
      );
      assert.deepEqual(
        (
          await db.query(
            "select role,status from public.memberships where user_id=$1",
            [users.outsider],
          )
        ).rows,
        [{ role: "member", status: "active" }],
      );
    } finally {
      await db.query("rollback");
    }
  },
);
sqlTest(
  "automatic enrollment and self-service enrollment cannot reactivate suspended members",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set public_registration_enabled=true where id=$1",
        [cid],
      );
      await db.query(
        "update public.memberships set status='suspended' where user_id=$1",
        [users.alice],
      );
      await db.query(
        "update auth.users set raw_user_meta_data='{" +
          '"display_name":"Alice","club_consent":true,"role":"admin"' +
          "}'::jsonb,email_confirmed_at=now() where id=$1",
        [users.alice],
      );
      assert.deepEqual(
        (
          await db.query(
            "select role,status from public.memberships where user_id=$1",
            [users.alice],
          )
        ).rows,
        [{ role: "member", status: "suspended" }],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      await assert.rejects(
        () => db.query("select public.join_public_competition('Alice',true)"),
        /suspended/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "completed days count unique dates only when all scheduled goals meet their targets",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date-2,ends_on=current_date+1 where id=$1",
        [cid],
      );
      const daily = await addGoal();
      const strength = await addGoal();
      await db.query(
        "update public.goals set weekdays=array[extract(dow from current_date-2)::int,extract(dow from current_date)::int] where id=$1",
        [strength],
      );
      await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date-2,10000,'honor'),($1,$2,$3,current_date-1,10000,'pending'),($1,$2,$3,current_date,20000,'verified'),($1,$2,$4,current_date,10000,'honor')",
        [cid, users.alice, daily, strength],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      assert.deepEqual(
        (
          await db.query(
            "select scheduled_goals,completed_goals,is_complete from public.daily_completion where user_id=$1 order by activity_date",
            [users.alice],
          )
        ).rows,
        [
          { scheduled_goals: 2, completed_goals: 1, is_complete: false },
          { scheduled_goals: 1, completed_goals: 1, is_complete: true },
          { scheduled_goals: 2, completed_goals: 2, is_complete: true },
        ],
      );
      assert.equal(
        (
          await db.query(
            "select completed_days from public.individual_scores where user_id=$1",
            [users.alice],
          )
        ).rows[0].completed_days,
        2,
      );
      assert.equal(
        Number(
          (
            await db.query(
              "select sum(completed_days) as n from public.goal_scores where user_id=$1",
              [users.alice],
            )
          ).rows[0].n,
        ),
        4,
      );
      assert.equal(
        Number(
          (
            await db.query(
              "select score from public.individual_scores where user_id=$1",
              [users.alice],
            )
          ).rows[0].score,
        ),
        75,
      );
      // Backfilling the missing scheduled goal turns that activity date into one
      // fully completed day, regardless of the later submission timestamp.
      await db.query(
        "select public.record_progress($1,current_date-2,10000,'Catch up',null,'UTC')",
        [strength],
      );
      assert.equal(
        (
          await db.query(
            "select completed_days from public.individual_scores where user_id=$1",
            [users.alice],
          )
        ).rows[0].completed_days,
        3,
      );
      assert.equal(
        Number(
          (
            await db.query(
              "select sum(completed_days) as n from public.goal_scores where user_id=$1",
              [users.alice],
            )
          ).rows[0].n,
        ),
        5,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "missing, under-target, zero and rejected goals prevent full completion",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date,ends_on=current_date where id=$1",
        [cid],
      );
      const gid = await addGoal();
      assert.equal(
        (
          await db.query(
            "select is_complete from public.daily_completion where user_id=$1",
            [users.alice],
          )
        ).rows[0].is_complete,
        false,
      );
      const {
        rows: [entry],
      } = await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date,0,'honor') returning id",
        [cid, users.alice, gid],
      );
      for (const [value, verification, complete] of [
        [0, "honor", false],
        [5000, "honor", false],
        [1000000, "rejected", false],
        [10000, "honor", true],
        [10000, "pending", true],
        [10000, "verified", true],
      ] as const) {
        await db.query(
          "update public.progress_entries set value=$1,verification=$2 where id=$3",
          [value, verification, entry.id],
        );
        assert.equal(
          (
            await db.query(
              "select is_complete from public.daily_completion where user_id=$1",
              [users.alice],
            )
          ).rows[0].is_complete,
          complete,
        );
        assert.equal(
          (
            await db.query(
              "select completed_days from public.individual_scores where user_id=$1",
              [users.alice],
            )
          ).rows[0].completed_days,
          complete ? 1 : 0,
        );
      }
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "rest days and members without goals do not earn completed days, and future dates are excluded",
  async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.competitions set starts_on=current_date-2,ends_on=current_date+1 where id=$1",
        [cid],
      );
      const gid = await addGoal();
      await db.query(
        "update public.goals set weekdays=array[extract(dow from current_date)::int,extract(dow from current_date+1)::int] where id=$1",
        [gid],
      );
      await db.query(
        "insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,verification) values($1,$2,$3,current_date,10000,'honor'),($1,$2,$3,current_date+1,10000,'honor')",
        [cid, users.alice, gid],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.daily_completion where user_id=$1",
            [users.alice],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            "select completed_days from public.individual_scores where user_id=$1",
            [users.alice],
          )
        ).rows[0].completed_days,
        1,
      );
      assert.equal(
        (
          await db.query(
            "select completed_days from public.individual_scores where user_id=$1",
            [users.bob],
          )
        ).rows[0].completed_days,
        0,
      );
    } finally {
      await db.query("rollback");
    }
  },
);

sqlTest(
  "daily completion retains competition privacy and denies anonymous access",
  async () => {
    await db.query("begin");
    try {
      const other = "20260000-0000-4000-8000-000000000099";
      await db.query(
        "insert into public.competitions(id,name,starts_on,ends_on) values($1,'Other',current_date,current_date)",
        [other],
      );
      await db.query(
        "insert into public.memberships(competition_id,user_id,display_name) values($1,$2,'Bob elsewhere')",
        [other, users.bob],
      );
      await db.query(
        "insert into public.goals(competition_id,user_id,title,category,target,unit) values($1,$2,'Other goal','fitness',1,'unit')",
        [other, users.bob],
      );
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.alice,
      ]);
      assert.equal(
        (
          await db.query(
            "select * from public.daily_completion where competition_id=$1",
            [other],
          )
        ).rowCount,
        0,
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.outsider,
      ]);
      assert.equal(
        (await db.query("select * from public.daily_completion")).rowCount,
        0,
      );
      await db.query("reset role");
      await db.query("set local role anon");
      await assert.rejects(
        () => db.query("select * from public.daily_completion"),
        /permission denied/,
      );
    } finally {
      await db.query("rollback");
    }
  },
);
