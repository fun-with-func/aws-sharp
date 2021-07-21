import sharp, { Sharp } from 'sharp';

export const decodeObjectKey = (objectKey: string): string => objectKey.replace('/+/g', ' ');

export const stripExtension = (fileName: string): string => fileName.substring(0, fileName.lastIndexOf('.'));

export const isSupportedFile = (fileName: string): boolean => /\.(png|jpg)$/.test(fileName) && !/(\.min\.)/.test(fileName);

export const imageToSharp = (file: Buffer): Sharp => sharp(file).removeAlpha();

export const sharpToImage = (sharp: Sharp): Promise<Buffer> => sharp.toBuffer();

export const transformImage = (
  instance: Sharp,
  name: string,
  dimensions: number[],
  formats: string[],
): { images: Sharp[]; names: string[] } => {
  const images: Sharp[] = [];
  const names: string[] = [];

  for (let index = 0; index < dimensions.length; index++) {
    const dimension = dimensions[index];

    for (let idx = 0; idx < formats.length; idx++) {
      const format = formats[idx];
      let image: Sharp;

      switch (format) {
        case 'webp': {
          image = instance.clone().webp().resize(dimension);
          break;
        }
        default: {
          image = instance.clone().jpeg({ progressive: true }).resize(dimension);
          break;
        }
      }

      images.push(image);

      names.push(`${name}_${dimension}.${format}`);
    }
  }

  return { images, names };
};
