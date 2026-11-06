import { cookies } from "next/headers";
export type Locale = "en" | "es";
export async function locale(): Promise<Locale> {
  return (await cookies()).get("locale")?.value === "es" ? "es" : "en";
}
export const copy = {
  en: {
    home: "Clubhouse",
    aboutMovember: "More than a moustache",
    movemberEyebrow: "THE STORY BEHIND NOVEMBER",
    movemberHistory:
      "Movember began in Melbourne, Australia, in 2003, when 30 friends took on the challenge of bringing back the moustache. That small idea grew into a worldwide movement for men’s health.",
    movemberMission:
      "Today, Movember supports mental health and suicide prevention, prostate cancer, and testicular cancer. The moustache is a conversation starter: a reminder to check in, talk openly, and look after ourselves and each other.",
    movemberConnection:
      "Our independently organized friends-and-family challenge carries that spirit into November: build healthy habits, stay connected, and encourage one another. Everyone is welcome—no moustache required.",
    movemberLearn: "Read Movember’s story",
    movemberGivingTitle: "Keep the good going",
    movemberGiving:
      "An optional donation to the official Movember organization is another way to support men’s health, during November or when our challenge ends. Donating is entirely your choice and does not affect scores, rankings, or prizes.",
    movemberDonate: "Explore donating to Movember",
    movemberExternal:
      "Opens the official Movember website. Donations are handled there, not through this app.",
    goals: "My goals",
    removeGoal: "Remove goal",
    goalRemoveWarning:
      "This permanently removes this goal and all its progress, screenshots, comments, and reactions. Your scores and rankings will be recalculated. This cannot be undone.",
    goalRemoveConfirm:
      "I understand and want to remove this goal and its progress.",
    goalRemoveError:
      "The goal could not be removed. Confirm the removal and try again. You can remove only your own goals.",
    goalRemoved: "Your goal and its progress have been removed.",
    goalRemovedCleanup:
      "Your goal and progress have been removed. Some screenshot files could not be cleaned up; contact an administrator.",
    catchUpHelp:
      "Choose today or an earlier scheduled day in November to catch up. Today uses your device’s timezone. You can report November activity until the end of December 2 (UTC). Saving an unreviewed goal on the same date replaces its existing entry and screenshot.",
    everyoneGoals: "Everyone’s goals",
    everyoneGoalsIntro:
      "See what everyone is working toward and cheer each other on.",
    goalViews: "Goal views",
    memberNoGoals: "No goals added yet.",
    goalsPrivacy:
      "Visible to active club members only. Screenshots remain private to their owners and administrators.",
    log: "Log progress",
    leaderboard: "Rankings",
    teams: "Family teams",
    community: "Activity feed",
    admin: "Administration",
    profile: "My profile",
    profileIntro: "Choose how your name appears throughout the club.",
    nameHelp:
      "Use 2–60 characters. Members will see this name in rankings, progress updates, and comments.",
    nameSaved: "Your display name has been updated.",
    nameInvalid: "Enter a display name with 2–60 characters.",
    nameSaveError: "Your name could not be saved. Please try again.",
    logout: "Sign out",
    tagline: "Small steps. Great company.",
    subtitle:
      "Thirty days of showing up for yourself. One unforgettable month together.",
    welcome: "Welcome to the club",
    join: "Join the challenge",
    login: "Sign in",
    signInCaptcha:
      "The security check failed or expired. Complete the refreshed check and try again. If this continues, contact the club administrator.",
    signInCredentials:
      "Unable to sign in. Check your email and password, or request a password reset.",
    signInUnverified: "Please verify your email before signing in.",
    signInRateLimited:
      "Too many sign-in attempts. Please wait before trying again.",
    signInUnavailable:
      "Sign-in is temporarily unavailable. Please try again or contact the club administrator.",
    authReference: "Support reference",
    email: "Email address",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    confirmPassword: "Repeat new password",
    passwordHelp:
      "Use 12–128 characters. Both passwords must match. You can show either field to check what you typed.",
    passwordMismatch: "Enter matching passwords with 12–128 characters.",
    passwordSaveError:
      "Could not save your password. Please try again. If your session expired, request a new reset email.",
    passwordSaved: "Your password has been updated.",
    recoveryContinue: "Continue to reset password",
    recoveryContinueHelp:
      "Select Continue to open the secure password form. Opening this page alone does not use your reset link.",
    recoveryInvalid:
      "This reset link is invalid, expired, or already used. Request a new reset email from Forgot password below.",
    resetRequestError:
      "Could not request a reset email. Check the email address and try again shortly.",
    name: "Display name",
    invite: "Invitation code",
    save: "Save",
    fitness: "Physical fitness",
    personal: "Personal growth",
    target: "Daily target",
    unit: "Unit",
    title: "Goal name",
    notes: "Notes (optional)",
    date: "Date",
    value: "Amount completed",
    screenshot: "Screenshot (optional, private)",
    submit: "Record progress",
    score: "Score",
    streak: "Streak",
    days: "days",
    prizes: "The winners’ circle",
    tba: "To Be Announced",
    first: "First place",
    second: "Second place",
    third: "Third place",
    empty: "A fresh start awaits.",
    schedule: "Scheduled weekdays",
    honor: "Honor system",
    verified: "Verified",
    pending: "Awaiting review",
    rejected: "Rejected",
    create: "Create",
    team: "Team name",
    comment: "Comment",
    announcements: "Club announcements",
    noGoals: "Set your first goal to begin your November story.",
    challenge: "The Great Movember Challenge",
    dates: "November 1–30, 2026",
    private: "Members’ club · Email verification required",
    rules: "How the score works",
    ruleText:
      "70% goal completion + 30% consistency. Fitness goals count twice. Your goals are averaged, so adding more goals gives no automatic advantage. Teams use the average of all their members. Missed days count as zero. Scores use scheduled days through today; final standings include all 30 days. Schedules and standings use UTC; the progress form defaults to your local date.",
    progress: "Your November, one day at a time.",
    back: "Back to the clubhouse",
    noData: "No entries yet. The next step is yours.",
    signup: "Create account",
    botCheck: "Bot protection",
    botError:
      "The security check could not load. Please retry or check your connection.",
    retry: "Retry",
    signupUnavailable:
      "New registration is not available yet. Please try again later.",
    signupInvalid:
      "Check your name, email, password (12–128 characters), consent, and security check, then try again.",
    joinError:
      "You must verify your email and accept the privacy terms to join. If your account is suspended, contact an administrator.",
    checkEmail:
      "Check your email to verify your account, then sign in. Membership is automatic; no invitation or approval is needed.",
    accept: "Accept invitation",
    settings:
      "Set up Supabase to open the club. See README.md for the secure setup steps.",
    locked:
      "Goal details lock when created. New goals are welcome through November 30 and count from November 1. Contact an administrator for corrections.",
    activity: "Recent activity",
    achievement: "Achievements",
    trophy: "Every day counts",
    reset: "Forgot password?",
    updatePassword: "Update password",
    choosePassword: "New password",
    verification: "Verification",
    reviewMode: "Progress review policy",
    reviewRequired: "Require administrator review",
    reviewModeHelp:
      "Honor system is the default, including entries with screenshots. Requiring review sends new and updated unreviewed entries to the review queue. Switching back to honor releases all pending entries; existing verified and rejected decisions stay unchanged. Pending entries count provisionally until rejected.",
    honorModeHelp:
      "Honor system: your progress counts without approval. Screenshots are optional.",
    requiredModeHelp:
      "Administrator review is enabled. Your progress counts provisionally while awaiting review. Screenshots are optional.",
    reviewModeSaved: "Progress review policy saved.",
    reviewModeError:
      "Could not save the progress review policy. Please try again.",
    members: "Members",
    inviteCreate: "Create invitation",
    inviteEmail: "Invited email",
    announcement: "Announcement",
    publish: "Publish",
    rankingNote:
      "Tied scores share a rank. Final prize ties require an administrator decision.",
    consent:
      "By joining, you agree that members can see your display name, goals, progress amounts, comments and rankings. Screenshots are visible only to you and administrators. Never upload sensitive health or personal information.",
  },
  es: {
    home: "El club",
    aboutMovember: "Mucho más que un bigote",
    movemberEyebrow: "LA HISTORIA DETRÁS DE NOVIEMBRE",
    movemberHistory:
      "Movember nació en Melbourne, Australia, en 2003, cuando 30 amigos aceptaron el reto de volver a ponerse bigote. Esa pequeña idea se convirtió en un movimiento mundial por la salud masculina.",
    movemberMission:
      "Hoy, Movember apoya la salud mental y la prevención del suicidio, y la lucha contra el cáncer de próstata y de testículos. El bigote abre conversaciones: nos recuerda preguntar cómo estamos, hablar con confianza y cuidarnos unos a otros.",
    movemberConnection:
      "Nuestro reto independiente de amigos y familiares lleva ese espíritu a noviembre: crear hábitos saludables, mantenernos conectados y animarnos mutuamente. Todos son bienvenidos, con o sin bigote.",
    movemberLearn: "Conoce la historia de Movember",
    movemberGivingTitle: "Que lo bueno continúe",
    movemberGiving:
      "Una donación opcional a la organización oficial de Movember es otra forma de apoyar la salud masculina, durante noviembre o al terminar nuestro reto. Donar es una decisión personal y no afecta a las puntuaciones, la clasificación ni los premios.",
    movemberDonate: "Información para donar a Movember",
    movemberExternal:
      "Abre la web oficial de Movember. Las donaciones se realizan allí, no en esta aplicación.",
    goals: "Mis metas",
    removeGoal: "Eliminar meta",
    goalRemoveWarning:
      "Se eliminarán permanentemente esta meta y todos sus registros, capturas, comentarios y reacciones. Se recalcularán tus puntuaciones y la clasificación. Esta acción no se puede deshacer.",
    goalRemoveConfirm: "Entiendo y quiero eliminar esta meta y sus registros.",
    goalRemoveError:
      "No se pudo eliminar la meta. Confirma la eliminación e inténtalo de nuevo. Solo puedes eliminar tus propias metas.",
    goalRemoved: "Se han eliminado tu meta y sus registros.",
    goalRemovedCleanup:
      "Se han eliminado tu meta y sus registros. No se pudieron borrar algunos archivos de capturas; contacta con un administrador.",
    catchUpHelp:
      "Elige hoy o un día programado anterior de noviembre para ponerte al día. Hoy se calcula en la zona horaria de tu dispositivo. Puedes registrar actividades de noviembre hasta el final del 2 de diciembre (UTC). Guardar una meta sin revisar en la misma fecha reemplaza su registro y captura.",
    everyoneGoals: "Metas de todos",
    everyoneGoalsIntro:
      "Descubre las metas de los demás y anímense mutuamente.",
    goalViews: "Vistas de metas",
    memberNoGoals: "Todavía no hay metas.",
    goalsPrivacy:
      "Solo los miembros activos del club pueden ver esta información. Las capturas siguen siendo privadas para sus propietarios y administradores.",
    log: "Registrar avance",
    leaderboard: "Clasificación",
    teams: "Equipos familiares",
    community: "Actividad",
    admin: "Administración",
    profile: "Mi perfil",
    profileIntro: "Elige cómo aparece tu nombre en todo el club.",
    nameHelp:
      "Usa entre 2 y 60 caracteres. Los miembros verán este nombre en la clasificación, los avances y los comentarios.",
    nameSaved: "Tu nombre visible se ha actualizado.",
    nameInvalid: "Introduce un nombre visible de entre 2 y 60 caracteres.",
    nameSaveError: "No se pudo guardar tu nombre. Inténtalo de nuevo.",
    logout: "Cerrar sesión",
    tagline: "Pequeños pasos. Gran compañía.",
    subtitle: "Treinta días para cuidarte. Un mes inolvidable juntos.",
    welcome: "Bienvenido al club",
    join: "Únete al reto",
    login: "Iniciar sesión",
    signInCaptcha:
      "La comprobación de seguridad falló o caducó. Completa la nueva comprobación e inténtalo de nuevo. Si continúa, contacta con el administrador.",
    signInCredentials:
      "No se pudo iniciar sesión. Revisa el correo y la contraseña o solicita restablecerla.",
    signInUnverified: "Verifica tu correo antes de iniciar sesión.",
    signInRateLimited:
      "Demasiados intentos de inicio de sesión. Espera antes de intentarlo de nuevo.",
    signInUnavailable:
      "El inicio de sesión no está disponible temporalmente. Inténtalo de nuevo o contacta con el administrador.",
    authReference: "Referencia de soporte",
    email: "Correo electrónico",
    password: "Contraseña",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    confirmPassword: "Repite la nueva contraseña",
    passwordHelp:
      "Usa entre 12 y 128 caracteres. Ambas contraseñas deben coincidir. Puedes mostrar cada campo para comprobar lo que escribiste.",
    passwordMismatch:
      "Introduce contraseñas iguales de entre 12 y 128 caracteres.",
    passwordSaveError:
      "No se pudo guardar la contraseña. Inténtalo de nuevo. Si la sesión caducó, solicita otro correo de recuperación.",
    passwordSaved: "Tu contraseña se ha actualizado.",
    recoveryContinue: "Continuar para restablecer la contraseña",
    recoveryContinueHelp:
      "Selecciona Continuar para abrir el formulario seguro. Abrir esta página no consume el enlace de recuperación.",
    recoveryInvalid:
      "Este enlace no es válido, ha caducado o ya se ha usado. Solicita otro correo desde ¿Olvidaste la contraseña? abajo.",
    resetRequestError:
      "No se pudo solicitar el correo. Comprueba la dirección e inténtalo de nuevo en unos momentos.",
    name: "Nombre visible",
    invite: "Código de invitación",
    save: "Guardar",
    fitness: "Actividad física",
    personal: "Crecimiento personal",
    target: "Objetivo diario",
    unit: "Unidad",
    title: "Nombre de la meta",
    notes: "Notas (opcional)",
    date: "Fecha",
    value: "Cantidad completada",
    screenshot: "Captura (opcional, privada)",
    submit: "Registrar avance",
    score: "Puntuación",
    streak: "Racha",
    days: "días",
    prizes: "El podio",
    tba: "Por anunciar",
    first: "Primer lugar",
    second: "Segundo lugar",
    third: "Tercer lugar",
    empty: "Te espera un nuevo comienzo.",
    schedule: "Días de la semana",
    honor: "Sistema de honor",
    verified: "Verificado",
    pending: "Pendiente de revisión",
    rejected: "Rechazado",
    create: "Crear",
    team: "Nombre del equipo",
    comment: "Comentar",
    announcements: "Anuncios del club",
    noGoals: "Crea tu primera meta para empezar tu historia de noviembre.",
    challenge: "El Gran Reto Movember",
    dates: "1–30 de noviembre de 2026",
    private: "Club de miembros · Verificación de correo requerida",
    rules: "Cómo se calcula la puntuación",
    ruleText:
      "70 % cumplimiento + 30 % constancia. Las metas físicas cuentan el doble. Se calcula el promedio de tus metas, sin ventaja por añadir más. Los equipos usan el promedio de todos sus miembros. Los días omitidos valen cero. Se cuentan los días programados hasta hoy; el resultado final incluye todo noviembre. Los horarios y la clasificación usan UTC; el formulario de progreso muestra tu fecha local.",
    progress: "Tu noviembre, un día a la vez.",
    back: "Volver al club",
    noData: "Aún no hay registros. El siguiente paso es tuyo.",
    signup: "Crear cuenta",
    botCheck: "Protección contra bots",
    botError:
      "No se pudo cargar la comprobación de seguridad. Reintenta o revisa tu conexión.",
    retry: "Reintentar",
    signupUnavailable:
      "El registro aún no está disponible. Inténtalo más tarde.",
    signupInvalid:
      "Revisa tu nombre, correo, contraseña (12–128 caracteres), consentimiento y comprobación de seguridad.",
    joinError:
      "Verifica tu correo y acepta las condiciones de privacidad para unirte. Si tu cuenta está suspendida, contacta con un administrador.",
    checkEmail:
      "Revisa tu correo para verificar tu cuenta y luego inicia sesión. La membresía es automática; no necesitas invitación ni aprobación.",
    accept: "Aceptar invitación",
    settings:
      "Configura Supabase para abrir el club. Consulta README.md para los pasos seguros.",
    locked:
      "Los detalles se bloquean al crear la meta. Puedes añadir metas hasta el 30 de noviembre; cuentan desde el día 1. Contacta con un administrador para corregirlas.",
    activity: "Actividad reciente",
    achievement: "Logros",
    trophy: "Cada día cuenta",
    reset: "¿Olvidaste la contraseña?",
    updatePassword: "Actualizar contraseña",
    choosePassword: "Nueva contraseña",
    verification: "Verificación",
    reviewMode: "Política de revisión del progreso",
    reviewRequired: "Exigir revisión del administrador",
    reviewModeHelp:
      "El sistema de honor es la opción predeterminada, incluso con capturas. Al exigir revisión, los registros nuevos y las actualizaciones sin revisar pasan a la cola. Al volver al sistema de honor se liberan los registros pendientes; se conservan las decisiones de verificación y rechazo. Los registros pendientes cuentan provisionalmente hasta ser rechazados.",
    honorModeHelp:
      "Sistema de honor: tu progreso cuenta sin aprobación. Las capturas son opcionales.",
    requiredModeHelp:
      "La revisión del administrador está activada. Tu progreso cuenta provisionalmente mientras se revisa. Las capturas son opcionales.",
    reviewModeSaved: "Se ha guardado la política de revisión del progreso.",
    reviewModeError:
      "No se pudo guardar la política de revisión. Inténtalo de nuevo.",
    members: "Miembros",
    inviteCreate: "Crear invitación",
    inviteEmail: "Correo del invitado",
    announcement: "Anuncio",
    publish: "Publicar",
    rankingNote:
      "Las puntuaciones iguales comparten puesto. Un administrador resolverá los empates para premios.",
    consent:
      "Al unirte, aceptas compartir con los miembros tu nombre visible, metas, cantidades de progreso, comentarios y clasificación. Solo tú y los administradores pueden ver tus capturas. No subas información médica o personal sensible.",
  },
};
export async function translations() {
  return copy[await locale()];
}
