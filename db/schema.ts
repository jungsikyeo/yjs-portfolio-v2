import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const contentCache=sqliteTable('content_cache',{id:text('id').primaryKey(),payload:text('payload'),nextAttempt:integer('next_attempt').notNull().default(0),leaseUntil:integer('lease_until').notNull().default(0)});
