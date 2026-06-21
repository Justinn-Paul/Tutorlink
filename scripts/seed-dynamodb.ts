/**
 * Seed TutorLink DynamoDB with dummy users, teachers, and optional deck rows.
 *
 * These accounts do NOT exist in Cognito — for local/staging UI + API testing only
 * (discovery feed, public teacher pages, etc.).
 *
 * Required env:
 *   AWS_REGION (or AWS_DEFAULT_REGION)
 *   DYNAMODB_USERS_TABLE
 *   DYNAMODB_TEACHER_PROFILES_TABLE
 *
 * Optional:
 *   DYNAMODB_DECKS_TABLE — also seeds one sample deck entry
 *
 * Usage:
 *   export AWS_REGION=ap-southeast-1
 *   export DYNAMODB_USERS_TABLE=tutorlink-users-staging
 *   export DYNAMODB_TEACHER_PROFILES_TABLE=tutorlink-teacher-profiles-staging
 *   npm run seed
 *
 * Dry run (no writes):
 *   npm run seed -- --dry-run
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SEED_DECKS, SEED_TEACHERS, SEED_USERS } from "./seed-data";

function isDryRun(): boolean {
  return process.argv.includes("--dry-run");
}

async function putItem(
  ddb: DynamoDBDocumentClient | null,
  tableName: string,
  item: Record<string, unknown> | object,
  label: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    console.log(`[dry-run] would put ${label} → ${tableName}`);
    return;
  }
  if (!ddb) throw new Error("DynamoDB client not initialised");
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    })
  );
  console.log(`✓ ${label}`);
}

async function main(): Promise<void> {
  const dryRun = isDryRun();
  const region =
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? (dryRun ? "ap-southeast-1" : undefined);
  if (!region) {
    throw new Error("Set AWS_REGION or AWS_DEFAULT_REGION");
  }

  const usersTable =
    process.env.DYNAMODB_USERS_TABLE?.trim() ??
    (dryRun ? "YOUR_USERS_TABLE" : undefined);
  const teacherProfilesTable =
    process.env.DYNAMODB_TEACHER_PROFILES_TABLE?.trim() ??
    (dryRun ? "YOUR_TEACHER_PROFILES_TABLE" : undefined);
  if (!usersTable || !teacherProfilesTable) {
    throw new Error(
      "Set DYNAMODB_USERS_TABLE and DYNAMODB_TEACHER_PROFILES_TABLE"
    );
  }
  const decksTable = process.env.DYNAMODB_DECKS_TABLE?.trim();

  if (dryRun) {
    console.log("Dry run — no DynamoDB writes.\n");
  }

  console.log(`Region: ${region}`);
  console.log(`Users table: ${usersTable}`);
  console.log(`Teacher profiles table: ${teacherProfilesTable}`);
  if (decksTable) {
    console.log(`Decks table: ${decksTable}`);
  }
  console.log("");

  const ddb = dryRun
    ? null
    : DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

  for (const user of SEED_USERS) {
    await putItem(ddb, usersTable, user, `user ${user.userId} (${user.name})`, dryRun);
  }

  for (const teacher of SEED_TEACHERS) {
    await putItem(
      ddb,
      teacherProfilesTable,
      teacher,
      `teacher ${teacher.teacherId} — ${teacher.subject} @ ${teacher.location}`,
      dryRun
    );
  }

  if (decksTable) {
    for (const deck of SEED_DECKS) {
      await putItem(
        ddb,
        decksTable,
        deck,
        `deck ${deck.studentId} → ${deck.teacherId}`,
        dryRun
      );
    }
  } else {
    console.log("(Skipping decks — set DYNAMODB_DECKS_TABLE to seed deck rows)");
  }

  console.log("");
  console.log("Done.");
  console.log("");
  console.log("Try discovery searches such as:");
  console.log('  subject=Primary Maths   location=Tampines');
  console.log('  subject=JC Chemistry    location=Clementi');
  console.log('  location=Bishan');
  console.log("");
  console.log("Note: teachers use verificationStatus=verified so they appear in discovery.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
