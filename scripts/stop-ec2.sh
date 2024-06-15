#!/bin/bash
set -e

# Fetch the instance ID of the last started running EC2 instance
LAST_STARTED_INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query 'Reservations[].Instances[].[InstanceId,LaunchTime]' \
    --output text \
    | sort -k2 -r \
    | head -n 1 \
    | awk '{print $1}')

# Check if we got an instance ID
if [ -n "$LAST_STARTED_INSTANCE_ID" ]; then
  # Terminate the instance
  aws ec2 terminate-instances --instance-ids "$LAST_STARTED_INSTANCE_ID"
  echo "Terminating instance ID: $LAST_STARTED_INSTANCE_ID"
else
  echo "No running EC2 instance found."
  exit 1
fi
