CREATE TABLE match_generation_jobs (
    id UUID PRIMARY KEY,
    user_profile_id BIGINT NOT NULL
        REFERENCES user_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX match_generation_jobs_one_active_per_user
    ON match_generation_jobs (user_profile_id)
    WHERE status IN ('queued', 'running');

CREATE INDEX match_generation_jobs_queued_created_at
    ON match_generation_jobs (created_at)
    WHERE status = 'queued';

CREATE INDEX match_generation_jobs_running_updated_at
    ON match_generation_jobs (updated_at)
    WHERE status = 'running';