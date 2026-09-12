import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const contentCache=sqliteTable('content_cache',{id:text('id').primaryKey(),payload:text('payload'),nextAttempt:integer('next_attempt').notNull().default(0),leaseUntil:integer('lease_until').notNull().default(0)});
// Plain-text bodies keyed by Notion page id and its last_edited_time, so unchanged pages skip the blocks API.
export const pageBodies=sqliteTable('page_bodies',{id:text('id').primaryKey(),edited:text('edited').notNull(),body:text('body').notNull()});
