  import qrcode from "qrcode";
  import invariant from "tiny-invariant";
  import db from "../db.server";

  export async function getQRCode(id, graphql) {
    const qrCode = await db.qRCode.findFirst({ where: { id } });

    if (!qrCode) {
      return null;
    }

    return supplementQRCode(qrCode, graphql);
  }

  export async function getQRCodes(shop, graphql, start, end, query) {
    const qrCodes = await db.qRCode.findMany({
      take: end,
      skip: start,
      where: {
        shop,
        title: {
          contains: query/* Optional filter */,
        },
      },
      orderBy: { id: "desc" },
    });


    if (qrCodes.length === 0) return [];

    return Promise.all(
      qrCodes.map((qrCode) => supplementQRCode(qrCode, graphql))
    );
  }

  // get length qr code
  export async function getQRCodesLength(shop, query) {
    const length = await db.qRCode.count({
      where: {
        shop,
        title: {
          contains: query, // Optional filter
        },
      },
    });

    return length;
  }

  export function getQRCodeImage(id) {
    const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
    return qrcode.toDataURL(url.href);
  }

  export function getDestinationUrl(qrCode) {
    if (qrCode.destination === "product") {
      return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
    }

    const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(qrCode.productVariantId);
    invariant(match, "Unrecognized product variant ID");

    return `https://${qrCode.shop}/cart/${match[1]}:1`;
  }

  async function supplementQRCode(qrCode, graphql) {
    const qrCodeImagePromise = getQRCodeImage(qrCode.id);

    const response = await graphql(
      `
        query supplementQRCode($id: ID!) {
          product(id: $id) {
            title
            images(first: 1) {
              nodes {
                altText
                url
              }
            }
          }
        }
      `,
      {
        variables: {
          id: qrCode.productId,
        },
      }
    );

    const {
      data: { product },
    } = await response.json();

    return {
      ...qrCode,
      productDeleted: !product?.title,
      productTitle: product?.title,
      productImage: product?.images?.nodes[0]?.url,
      productAlt: product?.images?.nodes[0]?.altText,
      destinationUrl: getDestinationUrl(qrCode),
      image: await qrCodeImagePromise,
    };
  }

  export function validateQRCode(data) {
    const errors = {};

    if (!data.title) {
      errors.title = "Title is required";
    }

    if (!data.productId) {
      errors.productId = "Product is required";
    }

    if (!data.destination) {
      errors.destination = "Destination is required";
    }

    if (Object.keys(errors).length) {
      return errors;
    }
  }
