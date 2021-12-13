#!/bin/bash

claudia_options() {
  echo --name $FUNCTION_NAME \
  --profile $PROFILE_NAME \
  --role $ROLE \
  --region $REGION \
  --version $STAGE \
  --layers $LAMBDA_LAYERS \
  --source dist \
  --handler index.handler \
  --description "Lambda to process images for every created image on specified S3 bucket" \
  --runtime nodejs14.x \
  --memory $MEMORY \
  --timeout $TIMEOUT \
  --no-optional-dependencies \
  --post-package-script rmDependencies \
  --aws-retries 1
}

cmd_create() {
  echo "::creating lambda::"
  npx claudia create $(claudia_options)
}

cmd_update() {
  echo "::updating lambda::"
  npx claudia update $(claudia_options)
}

cmd_delete() {
  echo "::destroying lambda::"
  npx claudia destroy \
  --profile $PROFILE_NAME
}

cmd_s3_event() {
  echo "::attaching s3 event::"
  npx claudia \
  --profile $PROFILE_NAME \
  add-s3-event-source \
  --source dist \
  --bucket $BUCKET \
  --events s3:ObjectCreated:*
}

cmd_build_layer() {
  echo "::building layer::"
  rm -rdf nodejs "$LAMBDA_LAYER_NAME".zip \
  && \
  rm -rdf "$LAMBDA_LAYER_NAME".zip \
  && mkdir -p nodejs \
  && cp package*.json nodejs \
  && cd nodejs \
  && npm i --production \
  && cd .. \
  && \
  zip -r "$LAMBDA_LAYER_NAME".zip nodejs \
  && \
  rm -rdf nodejs
}

function cmd_publish_layer() {
  if [ ! $SKIP_BUILD ]
  then
    eval cmd_build_layer
  fi
  echo "::publishing layer::"
  aws lambda \
  --profile $PROFILE_NAME \
  publish-layer-version \
  --license-info MIT \
  --layer-name $LAMBDA_LAYER_NAME \
  --compatible-runtimes nodejs14.x \
  --zip-file fileb://$LAMBDA_LAYER_NAME.zip \
  && \
  rm -rdf nodejs "$LAMBDA_LAYER_NAME".zip
}

# GENERAL
PROFILE_NAME=claudia

# LAMBDA
FUNCTION_NAME="aws-sharp"
# ROLE=
STAGE=development
REGION=us-east-1
MEMORY=512
TIMEOUT=5
# LAMBDA_LAYERS=

# S3
# BUCKET=

# LAMBDA LAYER
LAMBDA_LAYER_NAME=aws-sharp

while [ "$1" ]
do
  eval cmd_${1}
  { set +x; } 2>/dev/null
  shift
done