export const SELECT_ACTIVE_COLLECTION_AUTO_FILTER_JOB_BY_RULE_SQL = `
  SELECT
    job_id
  FROM auto_filter_jobs
  WHERE job_type = 'collection_sync'
    AND collection_id = $1
    AND rule_version = $2
    AND status IN ('pending', 'running')
  LIMIT 1
`;

export const SELECT_ACTIVE_ENTRY_AUTO_FILTER_JOB_SQL = `
  SELECT
    job_id
  FROM auto_filter_jobs
  WHERE job_type = 'entry_classification'
    AND word_id = $1
    AND status IN ('pending', 'running')
  LIMIT 1
`;

export const INSERT_COLLECTION_AUTO_FILTER_JOB_SQL = `
  INSERT INTO auto_filter_jobs (
    job_type,
    collection_id,
    rule_version,
    status
  )
  VALUES ('collection_sync', $1, $2, 'pending')
  RETURNING job_id
`;

export const INSERT_ENTRY_AUTO_FILTER_JOB_SQL = `
  INSERT INTO auto_filter_jobs (
    job_type,
    word_id,
    status
  )
  VALUES ('entry_classification', $1, 'pending')
  RETURNING job_id
`;

export const CLAIM_NEXT_AUTO_FILTER_JOB_SQL = `
  WITH next_job AS (
    SELECT job_id
    FROM auto_filter_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC, job_id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE auto_filter_jobs
  SET
    status = 'running',
    updated_at = NOW(),
    error_message = ''
  WHERE job_id IN (SELECT job_id FROM next_job)
  RETURNING
    job_id,
    job_type,
    collection_id,
    word_id,
    rule_version,
    status,
    error_message,
    created_at,
    updated_at
`;

export const COMPLETE_AUTO_FILTER_JOB_SQL = `
  UPDATE auto_filter_jobs
  SET
    status = 'completed',
    error_message = '',
    updated_at = NOW()
  WHERE job_id = $1
`;

export const FAIL_AUTO_FILTER_JOB_SQL = `
  UPDATE auto_filter_jobs
  SET
    status = 'failed',
    error_message = $2,
    updated_at = NOW()
  WHERE job_id = $1
`;
