#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push notifications
 * and store them in AWS Secrets Manager.
 *
 * Usage:
 *   npx tsx scripts/generate-vapid-keys.ts [--region ap-northeast-1] [--env default]
 *
 * This creates a Secrets Manager secret with the name:
 *   agentcore/{env}/vapid-keys
 *
 * The secret contains:
 *   { publicKey, privateKey, subject }
 */

import {
  SecretsManagerClient,
  CreateSecretCommand,
  GetSecretValueCommand,
  ResourceExistsException,
} from '@aws-sdk/client-secrets-manager';

// web-push is a devDependency for key generation only
async function generateVAPIDKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const webpush = await import('web-push');
  return webpush.generateVAPIDKeys();
}

async function main() {
  const args = process.argv.slice(2);
  const regionIdx = args.indexOf('--region');
  const envIdx = args.indexOf('--env');
  const subjectIdx = args.indexOf('--subject');

  const region = regionIdx >= 0 ? args[regionIdx + 1] : 'ap-northeast-1';
  const env = envIdx >= 0 ? args[envIdx + 1] : 'default';
  const subject = subjectIdx >= 0 ? args[subjectIdx + 1] : 'mailto:admin@example.com';
  const secretName = `agentcore/${env}/vapid-keys`;

  const client = new SecretsManagerClient({ region });

  // Check if secret already exists
  try {
    const existing = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const keys = JSON.parse(existing.SecretString || '{}');
    console.log('✅ VAPID keys already exist in Secrets Manager');
    console.log(`   Secret: ${secretName}`);
    console.log(`   Public Key: ${keys.publicKey}`);
    console.log('');
    console.log('To use in frontend .env:');
    console.log(`   VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
    return;
  } catch (err: unknown) {
    if (
      !(err instanceof Error) ||
      err.name !== 'ResourceNotFoundException'
    ) {
      throw err;
    }
  }

  // Generate new VAPID keys
  console.log('🔑 Generating new VAPID keys...');
  const vapidKeys = await generateVAPIDKeys();

  const secretValue = JSON.stringify({
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey,
    subject,
  });

  try {
    await client.send(
      new CreateSecretCommand({
        Name: secretName,
        SecretString: secretValue,
        Description: 'VAPID keys for Web Push notifications (Moca PWA)',
      })
    );

    console.log('✅ VAPID keys generated and stored in Secrets Manager');
    console.log(`   Secret: ${secretName}`);
    console.log(`   Public Key: ${vapidKeys.publicKey}`);
    console.log('');
    console.log('To use in frontend .env:');
    console.log(`   VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  } catch (err: unknown) {
    if (err instanceof ResourceExistsException) {
      console.log('⚠️  Secret already exists (race condition). Use existing keys.');
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed to generate VAPID keys:', err);
  process.exit(1);
});
