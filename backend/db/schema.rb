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

ActiveRecord::Schema[8.1].define(version: 2026_11_04_090017) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

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
    t.index ["plan_id"], name: "index_materials_on_plan_id"
    t.index ["task_id"], name: "index_materials_on_task_id", unique: true
    t.index ["user_id"], name: "index_materials_on_user_id"
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
  add_foreign_key "materials", "study_plans", column: "plan_id"
  add_foreign_key "materials", "study_tasks", column: "task_id"
  add_foreign_key "materials", "users"
  add_foreign_key "mistake_entries", "knowledge_nodes", column: "node_id"
  add_foreign_key "mistake_entries", "questions"
  add_foreign_key "mistake_entries", "quiz_sessions", column: "session_id"
  add_foreign_key "mistake_entries", "users"
  add_foreign_key "questions", "knowledge_nodes", column: "node_id"
  add_foreign_key "questions", "materials", column: "source_material_id"
  add_foreign_key "questions", "quiz_sessions", column: "session_id"
  add_foreign_key "questions", "users"
  add_foreign_key "quiz_sessions", "study_plans", column: "plan_id"
  add_foreign_key "quiz_sessions", "study_tasks", column: "task_id"
  add_foreign_key "quiz_sessions", "users"
  add_foreign_key "reading_progresses", "materials"
  add_foreign_key "reading_progresses", "users"
  add_foreign_key "section_markings", "materials"
  add_foreign_key "section_markings", "users"
  add_foreign_key "study_plans", "users"
  add_foreign_key "study_tasks", "knowledge_nodes", column: "node_id"
  add_foreign_key "study_tasks", "materials"
  add_foreign_key "study_tasks", "users"
end
