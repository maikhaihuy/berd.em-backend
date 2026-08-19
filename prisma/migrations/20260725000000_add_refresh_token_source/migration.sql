-- Add an optional marker for the flow that created a refresh-token session.
ALTER TABLE "refresh_tokens" ADD COLUMN "source" TEXT;
