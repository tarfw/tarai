-- Drop the Space / team-chat era tables. Every remaining code reference was
-- removed with them: contexts (Space hold/auto), team_channels +
-- channel_identities + channel_link_requests + channel_commands (Slack /
-- Discord / Google Chat team chat). Applied migrations 0001-0007 stay in
-- history; workspaces keep users / workspaces / members / workspace_invites,
-- the site authority tables, and limits.
DROP TABLE IF EXISTS channel_commands;
DROP TABLE IF EXISTS channel_link_requests;
DROP TABLE IF EXISTS channel_identities;
DROP TABLE IF EXISTS team_channels;
DROP TABLE IF EXISTS contexts;
