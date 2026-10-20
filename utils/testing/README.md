# Shared test infrastructure

Read [UTILS_RULES.md](../UTILS_RULES.md) for the test selection policy, folder responsibilities and commands.

Tests live in utils/checks/{architecture,gameplay,inventory,items,ui,platform,tooling}/.
suites/check_manifest.js is the only registry of stable check IDs and suite membership. The runner rejects missing,
duplicate and unregistered files, including nested folders. Root utils/*.js files remain user-facing tools.

| Folder | Responsibility |
| --- | --- |
| core/ | SourceRuntime, safe source loading and output-baseline comparison |
| runtime/ | Native ESM loading and production-shaped test compositions |
| doubles/, keepnet/ | Shared contract doubles and DOM double |
| live_bait/ | Feed/care/lifecycle scenarios shared by live-bait checks |
| styles/ | Stylesheet reading for ownership and essential input contracts |
| baselines/ | Tracked behavior reference output |

Inject doubles through constructors; do not add production globals. Each check runs in a separate Node process.
Extend an existing scenario when possible. Source/markup regex assertions are reserved for safety, architecture
or input contracts that cannot be exercised through the relevant adapter.

The game-cycle report is compared with baselines/game-cycle.txt. Structural/test-only changes leave it unchanged.
An intended gameplay change updates it through npm run baseline:game-cycle with its documented reason.
