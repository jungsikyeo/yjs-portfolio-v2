import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const contentCache=sqliteTable('content_cache',{id:text('id').primaryKey(),payload:text('payload'),nextAttempt:integer('next_attempt').notNull().default(0),leaseUntil:integer('lease_until').notNull().default(0)});
// Plain-text bodies keyed by Notion page id and its last_edited_time, so unchanged pages skip the blocks API.
export const pageBodies=sqliteTable('page_bodies',{id:text('id').primaryKey(),edited:text('edited').notNull(),body:text('body').notNull()});
// Contact-form submissions. Persisted before any relay so a failed email never loses a message; ip_hash is a salted SHA-256 prefix used only for rate limiting.
export const contactMessages=sqliteTable('contact_messages',{id:integer('id').primaryKey({autoIncrement:true}),createdAt:integer('created_at').notNull(),ipHash:text('ip_hash').notNull(),name:text('name').notNull(),email:text('email').notNull(),company:text('company'),message:text('message').notNull(),sent:integer('sent').notNull().default(0)});
