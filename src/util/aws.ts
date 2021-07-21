import s3, { Body, GetObjectOutput, GetObjectRequest, PutObjectOutput } from 'aws-sdk/clients/s3';

export const getS3Object = (client: s3, bucketName: string, objectKey: string): Promise<GetObjectOutput> => {
  const request: GetObjectRequest = {
    Bucket: bucketName,
    Key: objectKey,
  };

  return client.getObject(request).promise();
};

export const putS3Object = (client: s3, bucketName: string, objectKey: string, body: Body): Promise<PutObjectOutput> =>
  client
    .putObject({
      Bucket: bucketName,
      Key: objectKey,
      ACL: 'public-read', // TODO hardcoded
      Body: body,
      ContentType: 'image',
    })
    .promise();
