#!/usr/bin/env bash
# Daily MongoDB backup to Amazon S3.
#
# Dumps every database in the `mongo` container (compressed archive) and uploads
# it to s3://$BACKUP_BUCKET/mongo/. Old backups are deleted by an S3 lifecycle
# rule on the bucket (e.g. after 14 days), not by this script.
#
# One-time setup on the server (see the project notes for the AWS console part):
#   1. The EC2 instance has an IAM role allowed to s3:PutObject into the bucket.
#   2. AWS CLI installed:  sudo snap install aws-cli --classic
#   3. /home/ubuntu/Short_URL/.backup.env contains:  BACKUP_BUCKET=<bucket-name>
#   4. Daily at 02:30 server time (crontab -e):
#        30 2 * * * bash /home/ubuntu/Short_URL/ops/backup-mongo.sh >> /home/ubuntu/backup.log 2>&1
#
# Restore (overwrites matching collections in the running database):
#   aws s3 cp s3://<bucket>/mongo/<file>.archive.gz backup.archive.gz
#   docker compose exec -T mongo mongorestore --archive --gzip --drop < backup.archive.gz
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .backup.env ]; then
  echo "$(date -u +%FT%TZ) backup skipped: .backup.env (BACKUP_BUCKET=...) not found"
  exit 1
fi
# shellcheck disable=SC1091
source ./.backup.env
: "${BACKUP_BUCKET:?BACKUP_BUCKET is not set in .backup.env}"

stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
file="/tmp/mongo-backup-$stamp.archive.gz"

docker compose exec -T mongo mongodump --archive --gzip --quiet > "$file"

# A dump of a working database is never empty; refuse to upload a broken file.
if [ ! -s "$file" ]; then
  echo "$(date -u +%FT%TZ) backup FAILED: dump file is empty"
  rm -f "$file"
  exit 1
fi

size=$(du -h "$file" | cut -f1)
aws s3 cp "$file" "s3://$BACKUP_BUCKET/mongo/mongo-backup-$stamp.archive.gz" --only-show-errors
rm -f "$file"
echo "$(date -u +%FT%TZ) backup OK: s3://$BACKUP_BUCKET/mongo/mongo-backup-$stamp.archive.gz ($size)"
