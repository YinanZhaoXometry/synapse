# frozen_string_literal: true

# AD-13: the spine ER lands. Users first — every user-owned row in the ER
# scopes to this table via a user_id foreign key. Structural only (AD-15):
# email + password_digest set the column shape; auth logic arrives with its
# own epic.
class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users, id: :uuid, default: "gen_random_uuid()" do |t|
      t.string :email, null: false, index: { unique: true }
      t.string :password_digest, null: false

      t.timestamps
    end
  end
end
