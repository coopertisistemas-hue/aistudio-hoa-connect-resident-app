# ADR-09 Realtime Version Trace

Generated: 2026-07-19T15:11:19.483Z

## Local Versions

- Supabase CLI: `2.107.0`
- supabase_rest_aistudio-hoa-connect-resident-app	public.ecr.aws/supabase/postgrest:v14.13
- supabase_realtime_aistudio-hoa-connect-resident-app	public.ecr.aws/supabase/realtime:v2.107.5
- supabase_auth_aistudio-hoa-connect-resident-app	public.ecr.aws/supabase/gotrue:v2.190.0
- supabase_db_aistudio-hoa-connect-resident-app	public.ecr.aws/supabase/postgres:17.6.1.136

## Relevant Realtime Log Lines

- 15:09:58.170 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:03.172 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:08.173 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:13.174 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
-   {"public", "support_messages"} => [28275]
- 15:10:18.175 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:23.176 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:28.177 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:33.178 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:38.179 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:43.202 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:48.218 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:53.219 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:10:58.222 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:11:03.223 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:11:08.224 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
-   {"public", "support_messages"} => [28561]
- 15:11:18.226 project=realtime-dev [info] Billing metrics: [:realtime, :rate_counter, :channel, :db_events]
- 15:11:19.248 [info] Elixir.Realtime.RateCounter idle_shutdown reached for: {:channel, :presence_events, "realtime-dev"}

