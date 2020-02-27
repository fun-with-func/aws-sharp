const sharp = require('sharp');
const s3 = require('aws-sdk/clients/s3');

const { S3_BUCKET } = process.env;

const S3 = new s3({ region: 'us-east-1' });
const dimensions = [ 256, 512 ];
const formats = [ 'webp', 'jpeg' ];

const handler = async (event) => {
    'use strict';

    // todo from s3 getobject
    const img = image('./test.jpg');
    const metadata = await img.metadata();
    console.log(metadata);

    const { images, filenames } = buildSharpInstances(dimensions, formats);
    const buffers = sharpInstanceToBuffer(images);

    const s3Promises = [];
    buffers.forEach((buffer, idx) =>
        s3Promises.push(
            S3.putObject({
                Bucket: S3_BUCKET || 'faas-image-processor', // TODO same bucket where notification comes
                Key: filenames[idx],
                ACL: 'public-read',
                Body: buffer,
            }).promise(),
        ),
    );
    await Promise.all(s3Promises);

    return {
        statusCode: 200,
        body: 'file uploaded',
    };
};

const image = (file = '') => {
    return sharp(file).removeAlpha();
};

const buildSharpInstances = (img = sharp, dimensions = [], formats = []) => {
    const images = [];
    const filenames = [];

    for (let index = 0; index < dimensions.length; index++) {
        const dimension = dimensions[index];

        for (let idx = 0; idx < formats.length; idx++) {
            const format = formats[idx];

            let image;

            switch (format) {
                case 'webp': {
                    image = img.clone().webp().resize(dimension);
                    break;
                }
                default: {
                    image = img.clone().jpeg({ progressive: true }).resize(dimension);
                    break;
                }
            }

            images.push(image);
            filenames.push(`thumb_${dimension}.${format}`);
        }
    }

    return { images, filenames };
};

const sharpInstanceToBuffer = (images = []) => {
    const filePromises = [];
    images.forEach((image) => filePromises.push(image.toBuffer()));
    return Promise.all(filePromises);
};
const sharpInstanceToFile = (images = [], filenames = []) => {
    const filePromises = [];
    images.forEach((image, idx) => filePromises.push(image.toFile(filenames[idx])));
    return Promise.all(filePromises);
};

exports.handler = handler;
