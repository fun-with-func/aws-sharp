# aws-sharp

Lambda to transform images uploaded to S3 bucket (and help not to do it manually :sunglasses:)

## Description

Inspired (almost a copy) from an example AWS has previously (not sure where is now)

## Built with

- [sharp](https://github.com/lovell/sharp) to transform images
- [claudiaJS](https://github.com/claudiajs/claudia) to upload it to AWS
- typescript

## Deployment

- create / upload / delete the AWS Lambda
- create / upload AWS Lambda Layer
- attach S3 Event to a Bucket

There is a `script.sh` how do most of this work.
