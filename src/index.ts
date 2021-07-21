import { S3Event } from 'aws-lambda';
import s3, { GetObjectOutput, PutObjectOutput } from 'aws-sdk/clients/s3';
import { decodeObjectKey, imageToSharp, isSupportedFile, sharpToImage, stripExtension, transformImage } from './util';
import { getS3Object, putS3Object } from './util/aws';

const { S3_REGION, S3_OUTPUT_BUCKET, DIMENSIONS } = process.env;
const client: s3 = new s3({ region: S3_REGION || 'us-east-1' });
const dimensions: number[] = DIMENSIONS
  ? DIMENSIONS.split(',')
      .map(string => string.trim())
      .map(dimension => +dimension)
  : [256];
const formats = ['jpeg'];

exports.handler = async ({ Records }: S3Event) => {
  for (const record of Records) {
    const {
      s3: {
        bucket: { name: bucketName },
        object: { key: object, size },
      },
    } = record;
    const decodedObjectKey = decodeObjectKey(object);
    const objectKey = stripExtension(decodedObjectKey);

    if (!isSupportedFile(decodedObjectKey) || size <= 0) {
      return {
        statusCode: 400,
        body: `Could not process file '${bucketName}/${decodedObjectKey}'`,
      };
    }

    let tmpFile: GetObjectOutput;
    try {
      tmpFile = await getS3Object(client, bucketName, decodedObjectKey);
    } catch (e) {
      console.error(e);
      return {
        statusCode: 500,
        body: `Could not download '${bucketName}/${decodedObjectKey}'`,
      };
    }

    const sharpInstance = imageToSharp(tmpFile.Body as Buffer);
    const { images, names } = transformImage(sharpInstance, objectKey, dimensions, formats);

    try {
      const promises: Promise<Buffer>[] = images.map(sharpToImage);
      const transformedImages = await Promise.all(promises);
      const requests = uploadImages(transformedImages, names, bucketName);

      await Promise.all(requests);
    } catch (e) {
      console.error(e);
      return {
        statusCode: 500,
        body: 'Could not upload images',
      };
    }
  }

  return {
    statusCode: 200,
    body: 'Files uploaded',
  };
};

const uploadImages = (images: Buffer[], fileName: string[], bucketName: string): Promise<PutObjectOutput>[] => {
  const promises: Promise<PutObjectOutput>[] = [];

  images.forEach((image, index) => {
    const objectKey = `${S3_OUTPUT_BUCKET ? S3_OUTPUT_BUCKET + '/' : ''}${fileName[index]}`;
    const promise = putS3Object(client, bucketName, objectKey, image);

    promises.push(promise);
  });

  return promises;
};
