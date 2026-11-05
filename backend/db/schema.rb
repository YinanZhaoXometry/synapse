# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_05_130001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.uuid "record_id", null: false
    t.uuid "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "ai_usage_counters", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.date "day", null: false
    t.integer "call_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "day"], name: "index_ai_usage_counters_on_user_id_and_day", unique: true
    t.index ["user_id"], name: "index_ai_usage_counters_on_user_id"
  end

  create_table "annotations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "material_id", null: false
    t.jsonb "locator", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id"], name: "index_annotations_on_material_id"
    t.index ["user_id"], name: "index_annotations_on_user_id"
  end

  create_table "chat_threads", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "material_id", null: false
    t.jsonb "messages", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id"], name: "index_chat_threads_on_material_id", unique: true
    t.index ["user_id"], name: "index_chat_threads_on_user_id"
  end

  create_table "evidence_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "node_id", null: false
    t.uuid "session_id"
    t.uuid "question_id"
    t.string "outcome", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["node_id"], name: "index_evidence_records_on_node_id"
    t.index ["question_id"], name: "index_evidence_records_on_question_id"
    t.index ["session_id"], name: "index_evidence_records_on_session_id"
    t.index ["user_id"], name: "index_evidence_records_on_user_id"
    t.check_constraint "outcome::text = ANY (ARRAY['correct'::character varying::text, 'partial'::character varying::text, 'wrong'::character varying::text])", name: "evidence_records_outcome_check"
  end

  create_table "flashcards", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "material_id", null: false
    t.uuid "node_id"
    t.text "front", null: false
    t.text "back", null: false
    t.string "difficulty"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id"], name: "index_flashcards_on_material_id"
    t.index ["node_id"], name: "index_flashcards_on_node_id"
    t.index ["user_id"], name: "index_flashcards_on_user_id"
    t.check_constraint "difficulty IS NULL OR (difficulty::text = ANY (ARRAY['hard'::character varying::text, 'medium'::character varying::text, 'easy'::character varying::text]))", name: "flashcards_difficulty_check"
  end

  create_table "knowledge_nodes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "plan_id"
    t.uuid "task_id"
    t.string "stage"
    t.string "title", null: false
    t.integer "order", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["plan_id"], name: "index_knowledge_nodes_on_plan_id"
    t.index ["task_id"], name: "index_knowledge_nodes_on_task_id", unique: true
    t.index ["user_id"], name: "index_knowledge_nodes_on_user_id"
  end

  create_table "material_node_mappings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "material_id", null: false
    t.uuid "node_id"
    t.string "section_id", null: false
    t.string "proposed_node_title"
    t.string "status", default: "proposed", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id"], name: "index_material_node_mappings_on_material_id"
    t.index ["node_id"], name: "index_material_node_mappings_on_node_id"
    t.index ["user_id", "material_id", "section_id"], name: "index_material_node_mappings_on_user_material_section", unique: true
    t.index ["user_id"], name: "index_material_node_mappings_on_user_id"
    t.check_constraint "status::text = ANY (ARRAY['proposed'::character varying::text, 'confirmed'::character varying::text, 'rejected'::character varying::text])", name: "material_node_mappings_status_check"
  end

  create_table "materials", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "plan_id"
    t.uuid "task_id"
    t.string "title", null: false
    t.string "kind", null: false
    t.bigint "size_bytes", null: false
    t.string "parse_state", default: "pending", null: false
    t.string "parse_failure_reason"
    t.jsonb "sections", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "attachment_scope", default: "plan", null: false
    t.uuid "node_id"
    t.index ["node_id"], name: "index_materials_on_node_id"
    t.index ["plan_id"], name: "index_materials_on_plan_id"
    t.index ["task_id"], name: "index_materials_on_task_id", unique: true
    t.index ["user_id"], name: "index_materials_on_user_id"
    t.check_constraint "attachment_scope::text = ANY (ARRAY['plan'::character varying::text, 'node'::character varying::text])", name: "materials_attachment_scope_check"
    t.check_constraint "kind::text = ANY (ARRAY['pdf'::character varying::text, 'markdown'::character varying::text])", name: "materials_kind_check"
    t.check_constraint "parse_failure_reason IS NULL OR (parse_failure_reason::text = ANY (ARRAY['corrupt'::character varying::text, 'encrypted'::character varying::text, 'empty'::character varying::text, 'unknown'::character varying::text]))", name: "materials_parse_failure_reason_check"
    t.check_constraint "parse_state::text = ANY (ARRAY['pending'::character varying::text, 'parsing'::character varying::text, 'parsed'::character varying::text, 'failed'::character varying::text])", name: "materials_parse_state_check"
  end

  create_table "mistake_entries", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "question_id", null: false
    t.uuid "session_id"
    t.uuid "node_id", null: false
    t.text "user_answer", null: false
    t.jsonb "source_location", null: false
    t.boolean "forfeited", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["node_id"], name: "index_mistake_entries_on_node_id"
    t.index ["question_id"], name: "index_mistake_entries_on_question_id"
    t.index ["session_id"], name: "index_mistake_entries_on_session_id"
    t.index ["user_id"], name: "index_mistake_entries_on_user_id"
  end

  create_table "notes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "plan_id"
    t.uuid "node_id"
    t.uuid "material_id"
    t.string "scope", null: false
    t.string "title", null: false
    t.text "body", null: false
    t.jsonb "enrichment", default: [], null: false
    t.jsonb "targeting", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id"], name: "index_notes_on_material_id"
    t.index ["node_id"], name: "index_notes_on_node_id"
    t.index ["plan_id"], name: "index_notes_on_plan_id"
    t.index ["user_id"], name: "index_notes_on_user_id"
    t.check_constraint "scope::text = 'plan'::text AND plan_id IS NOT NULL AND node_id IS NULL AND material_id IS NULL OR scope::text = 'node'::text AND node_id IS NOT NULL AND plan_id IS NULL AND material_id IS NULL OR scope::text = 'material'::text AND material_id IS NOT NULL AND plan_id IS NULL AND node_id IS NULL", name: "notes_scope_id_xor_check"
    t.check_constraint "scope::text = ANY (ARRAY['plan'::character varying::text, 'node'::character varying::text, 'material'::character varying::text])", name: "notes_scope_check"
  end

  create_table "questions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "session_id", null: false
    t.uuid "node_id", null: false
    t.string "kind", null: false
    t.text "prompt", null: false
    t.jsonb "options"
    t.integer "correct_option_index"
    t.uuid "source_material_id", null: false
    t.string "source_section_id", null: false
    t.jsonb "keywords"
    t.text "explanation", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "position", null: false
    t.index ["node_id"], name: "index_questions_on_node_id"
    t.index ["session_id"], name: "index_questions_on_session_id"
    t.index ["source_material_id"], name: "index_questions_on_source_material_id"
    t.index ["user_id"], name: "index_questions_on_user_id"
    t.check_constraint "kind::text = ANY (ARRAY['open'::character varying::text, 'choice'::character varying::text])", name: "questions_kind_check"
  end

  create_table "quiz_sessions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "plan_id"
    t.uuid "task_id"
    t.string "mode", null: false
    t.string "status", default: "active", null: false
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["plan_id"], name: "index_quiz_sessions_on_plan_id"
    t.index ["task_id"], name: "index_quiz_sessions_on_task_id"
    t.index ["user_id"], name: "index_quiz_sessions_on_user_id"
    t.check_constraint "(plan_id IS NOT NULL) <> (task_id IS NOT NULL)", name: "quiz_sessions_exactly_one_owner_check"
    t.check_constraint "mode::text = ANY (ARRAY['open'::character varying::text, 'choice'::character varying::text, 'mix'::character varying::text])", name: "quiz_sessions_mode_check"
    t.check_constraint "status::text = ANY (ARRAY['active'::character varying::text, 'completed'::character varying::text, 'abandoned'::character varying::text])", name: "quiz_sessions_status_check"
  end

  create_table "reading_progresses", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "material_id", null: false
    t.jsonb "position", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id"], name: "index_reading_progresses_on_material_id", unique: true
    t.index ["user_id"], name: "index_reading_progresses_on_user_id"
  end

  create_table "requeue_schedules", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "schedulable_type", null: false
    t.uuid "schedulable_id", null: false
    t.integer "stage", default: 0, null: false
    t.datetime "next_due_at", null: false
    t.datetime "last_source_timestamp", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["next_due_at"], name: "index_requeue_schedules_on_next_due_at"
    t.index ["schedulable_type", "schedulable_id"], name: "index_requeue_schedules_on_schedulable_uniqueness", unique: true
    t.index ["user_id", "next_due_at"], name: "index_requeue_schedules_on_user_id_and_next_due_at"
    t.index ["user_id"], name: "index_requeue_schedules_on_user_id"
  end

  create_table "section_markings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "material_id", null: false
    t.string "section_id", null: false
    t.datetime "claimed_at", null: false
    t.datetime "cleared_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id"], name: "index_section_markings_on_material_id"
    t.index ["user_id"], name: "index_section_markings_on_user_id"
  end

  create_table "solid_queue_batch_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "batch_id", null: false
    t.datetime "created_at", null: false
    t.index ["batch_id"], name: "index_solid_queue_batch_executions_on_batch_id"
    t.index ["job_id"], name: "index_solid_queue_batch_executions_on_job_id", unique: true
  end

  create_table "solid_queue_batches", force: :cascade do |t|
    t.string "active_job_batch_id"
    t.string "description"
    t.text "on_finish"
    t.text "on_success"
    t.text "on_failure"
    t.text "metadata"
    t.integer "total_jobs", default: 0, null: false
    t.integer "completed_jobs", default: 0, null: false
    t.integer "failed_jobs", default: 0, null: false
    t.datetime "enqueued_at"
    t.datetime "finished_at"
    t.datetime "failed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active_job_batch_id"], name: "index_solid_queue_batches_on_active_job_batch_id", unique: true
    t.index ["finished_at"], name: "index_solid_queue_batches_on_finished_at"
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.string "concurrency_key", null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.text "error"
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "queue_name", null: false
    t.string "class_name", null: false
    t.text "arguments"
    t.integer "priority", default: 0, null: false
    t.string "active_job_id"
    t.datetime "scheduled_at"
    t.datetime "finished_at"
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "batch_id"
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["batch_id"], name: "index_solid_queue_jobs_on_batch_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.string "queue_name", null: false
    t.datetime "created_at", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.bigint "supervisor_id"
    t.integer "pid", null: false
    t.string "hostname"
    t.text "metadata"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "task_key", null: false
    t.datetime "run_at", null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.string "key", null: false
    t.string "schedule", null: false
    t.string "command", limit: 2048
    t.string "class_name"
    t.text "arguments"
    t.string "queue_name"
    t.integer "priority", default: 0
    t.boolean "static", default: true, null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.datetime "scheduled_at", null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.string "key", null: false
    t.integer "value", default: 1, null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "stream_tickets", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "op", null: false
    t.string "token", null: false
    t.jsonb "payload", default: {}, null: false
    t.datetime "expires_at", null: false
    t.datetime "consumed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token"], name: "index_stream_tickets_on_token", unique: true
    t.index ["user_id"], name: "index_stream_tickets_on_user_id"
    t.check_constraint "op::text = ANY (ARRAY['companion'::character varying::text, 'proposal'::character varying::text, 'plan_companion'::character varying::text])", name: "stream_tickets_op_check"
  end

  create_table "study_plans", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "topic", null: false
    t.string "goal"
    t.string "visibility", default: "private", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_study_plans_on_user_id"
    t.check_constraint "visibility::text = ANY (ARRAY['private'::character varying::text, 'public'::character varying::text])", name: "study_plans_visibility_check"
  end

  create_table "study_tasks", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "material_id", null: false
    t.uuid "node_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id"], name: "index_study_tasks_on_material_id"
    t.index ["node_id"], name: "index_study_tasks_on_node_id"
    t.index ["user_id"], name: "index_study_tasks_on_user_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "email", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "ai_usage_counters", "users"
  add_foreign_key "annotations", "materials"
  add_foreign_key "annotations", "users"
  add_foreign_key "chat_threads", "materials"
  add_foreign_key "chat_threads", "users"
  add_foreign_key "evidence_records", "knowledge_nodes", column: "node_id"
  add_foreign_key "evidence_records", "questions"
  add_foreign_key "evidence_records", "quiz_sessions", column: "session_id"
  add_foreign_key "evidence_records", "users"
  add_foreign_key "flashcards", "knowledge_nodes", column: "node_id"
  add_foreign_key "flashcards", "materials"
  add_foreign_key "flashcards", "users"
  add_foreign_key "knowledge_nodes", "study_plans", column: "plan_id"
  add_foreign_key "knowledge_nodes", "study_tasks", column: "task_id"
  add_foreign_key "knowledge_nodes", "users"
  add_foreign_key "material_node_mappings", "knowledge_nodes", column: "node_id"
  add_foreign_key "material_node_mappings", "materials"
  add_foreign_key "material_node_mappings", "users"
  add_foreign_key "materials", "knowledge_nodes", column: "node_id"
  add_foreign_key "materials", "study_plans", column: "plan_id"
  add_foreign_key "materials", "study_tasks", column: "task_id"
  add_foreign_key "materials", "users"
  add_foreign_key "mistake_entries", "knowledge_nodes", column: "node_id"
  add_foreign_key "mistake_entries", "questions"
  add_foreign_key "mistake_entries", "quiz_sessions", column: "session_id"
  add_foreign_key "mistake_entries", "users"
  add_foreign_key "notes", "knowledge_nodes", column: "node_id"
  add_foreign_key "notes", "materials"
  add_foreign_key "notes", "study_plans", column: "plan_id"
  add_foreign_key "notes", "users"
  add_foreign_key "questions", "knowledge_nodes", column: "node_id"
  add_foreign_key "questions", "materials", column: "source_material_id"
  add_foreign_key "questions", "quiz_sessions", column: "session_id"
  add_foreign_key "questions", "users"
  add_foreign_key "quiz_sessions", "study_plans", column: "plan_id"
  add_foreign_key "quiz_sessions", "study_tasks", column: "task_id"
  add_foreign_key "quiz_sessions", "users"
  add_foreign_key "reading_progresses", "materials"
  add_foreign_key "reading_progresses", "users"
  add_foreign_key "requeue_schedules", "users"
  add_foreign_key "section_markings", "materials"
  add_foreign_key "section_markings", "users"
  add_foreign_key "solid_queue_batch_executions", "solid_queue_batches", column: "batch_id", on_delete: :cascade
  add_foreign_key "solid_queue_batch_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "stream_tickets", "users"
  add_foreign_key "study_plans", "users"
  add_foreign_key "study_tasks", "knowledge_nodes", column: "node_id"
  add_foreign_key "study_tasks", "materials"
  add_foreign_key "study_tasks", "users"
end
