import sharp from 'sharp';
import s3, { GetObjectOutput, PutObjectOutput } from 'aws-sdk/clients/s3';

const { S3_REGION, S3_OUTPUT_FOLDER, DIMENSIONS } = process.env;
const client = new s3({ region: S3_REGION || 'us-east-1' });
const dimensions: number[] = DIMENSIONS ? DIMENSIONS.split(',').map((dimension) => +dimension) : [ 256 ];
const formats = [ 'webp', 'jpeg' ];
const s3ACL = 'public-read';

const handler = async (event: { Records: { s3: { bucket: { name: string }; object: { key: string; size: number } } }[] }) => {
  const { s3: { bucket: { name: bucketName }, object: { key: encodedObjectKey, size } } } = event.Records[0];
  const decodedObjectKey = decodeObjectKey(encodedObjectKey);
  const objectKey = objectKeyWithoutExtension(decodedObjectKey);

  if (!isSupportedFile(decodedObjectKey)) {
    return {
      statusCode: 400,
      body: `File '${bucketName}/${decodedObjectKey}' not supported`,
    };
  }

  if (size <= 0) {
    return {
      statusCode: 400,
      body: `File '${bucketName}/${decodedObjectKey}' is empty`,
    };
  }

  let tmpFile: GetObjectOutput;

  try {
    tmpFile = await downloadFileFromS3Bucket(bucketName, decodedObjectKey);
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: `Could not download '${bucketName}/${decodedObjectKey}'`,
    };
  }

  const image = s3ObjectToSharp(tmpFile.Body as Buffer);
  const { images, fileNameSuffix } = sharpInstancesFromDimensions(image, dimensions, formats, objectKey);

  try {
    const promises: Promise<Buffer | sharp.OutputInfo>[] = sharpInstanceToOutput(images);
    const outputs = await Promise.all(promises);

    const requests = outputToS3OutputRequest(outputs, fileNameSuffix, bucketName);
    await Promise.all(requests);
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: 'Could not upload images',
    };
  }

  return {
    statusCode: 200,
    body: 'Files uploaded',
  };
};

const s3ObjectToSharp = (file: string | Buffer): sharp.Sharp => {
  return sharp(file).removeAlpha();
};

const sharpInstancesFromDimensions = (
  image: sharp.Sharp,
  dimensions: number[],
  formats: string[],
  objectKey: string,
): { images: sharp.Sharp[]; fileNameSuffix: string[] } => {
  const images: sharp.Sharp[] = [];
  const fileNameSuffix: string[] = [];

  for (let index = 0; index < dimensions.length; index++) {
    const dimension = dimensions[index];

    for (let idx = 0; idx < formats.length; idx++) {
      const format = formats[idx];
      let instance: sharp.Sharp;

      switch (format) {
        case 'webp': {
          instance = image.clone().webp().resize(dimension);
          break;
        }
        default: {
          instance = image.clone().jpeg({ progressive: true }).resize(dimension);
          break;
        }
      }

      images.push(instance);
      fileNameSuffix.push(`${objectKey}_${dimension}.${format}`);
    }
  }

  return { images, fileNameSuffix };
};

const decodeObjectKey = (objectKey: string) => {
  return objectKey.replace('/+/g', ' ');
};

const objectKeyWithoutExtension = (objectKey: string) => {
  return objectKey.substring(0, objectKey.lastIndexOf('.'));
};

const isSupportedFile = (fileName: string) => {
  const allowed = [ 'png', 'jpg' ];
  const disallowed = [ '.min.', ...(S3_OUTPUT_FOLDER ? [ S3_OUTPUT_FOLDER ] : []), ...formats ];

  return (
    allowed.find((allowedFormat) => fileName.includes(allowedFormat)) &&
    !disallowed.find((disallowedFormat) => fileName.includes(disallowedFormat))
  );
};

const downloadFileFromS3Bucket = (bucketName: string, objectKey: string): Promise<GetObjectOutput> => {
  return client
    .getObject({
      Bucket: bucketName,
      Key: objectKey,
    })
    .promise();
};

const sharpInstanceToOutput = (images: sharp.Sharp[], filenames: string[] = []): Promise<Buffer | sharp.OutputInfo>[] => {
  const promises: Promise<Buffer | sharp.OutputInfo>[] = [];

  if (!filenames.length) {
    images.forEach((image) => promises.push(image.toBuffer()));
  }
  if (filenames.length) {
    images.forEach((image, index) => promises.push(image.toFile(filenames[index])));
  }

  return promises;
};

const outputToS3OutputRequest = (
  outputs: (Buffer | sharp.OutputInfo)[],
  fileName: string[],
  bucketName: string,
): Promise<PutObjectOutput>[] => {
  const s3Promises: Promise<PutObjectOutput>[] = [];

  outputs.forEach((output, index) => {
    const promise = client
      .putObject({
        Bucket: bucketName,
        Key: `${S3_OUTPUT_FOLDER ? S3_OUTPUT_FOLDER + '/' : ''}${fileName[index]}`,
        ACL: s3ACL,
        Body: output,
        ContentType: 'image',
      })
      .promise();
    s3Promises.push(promise);
  });

  return s3Promises;
};

exports.handler = handler;
