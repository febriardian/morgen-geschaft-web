import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deleteUploadedImage,
  getCloudinaryConfig,
  getCloudinaryStatus,
  isAllowedUploadedImageUrl,
  uploadImageWithFallback,
  verifyCloudinaryConnection,
} from "../src/services/imageCdn.js";

const COMPLETE_ENV = {
  CLOUDINARY_CLOUD_NAME: "morgen-cloud",
  CLOUDINARY_API_KEY: "123456",
  CLOUDINARY_API_SECRET: "secret-for-test",
};

function createCloudinaryClient(overrides = {}) {
  const calls = {
    config: [],
    destroy: [],
    upload: [],
    ping: 0,
  };
  const client = {
    config(options) {
      calls.config.push(options);
    },
    api: {
      async ping() {
        calls.ping += 1;
        return { status: "ok" };
      },
    },
    uploader: {
      async upload(filePath, options) {
        calls.upload.push({ filePath, options });
        return {
          secure_url: "https://res.cloudinary.com/morgen-cloud/image/upload/v123/morgen-geschaft/admin/sample.webp",
          public_id: "morgen-geschaft/admin/sample",
          width: 800,
          height: 800,
          format: "webp",
          bytes: 12345,
        };
      },
      async destroy(publicId, options) {
        calls.destroy.push({ publicId, options });
        return { result: "ok" };
      },
    },
    ...overrides,
  };
  return { client, calls };
}

describe("Cloudinary configuration", () => {
  it("requires cloud name, API key, and API secret as one set", () => {
    const complete = getCloudinaryConfig(COMPLETE_ENV);
    assert.equal(complete.configured, true);
    assert.deepEqual(complete.missing, []);

    const partial = getCloudinaryStatus({
      CLOUDINARY_CLOUD_NAME: "morgen-cloud",
      CLOUDINARY_API_KEY: "",
      CLOUDINARY_API_SECRET: "",
    });
    assert.equal(partial.requested, true);
    assert.equal(partial.configured, false);
    assert.equal(partial.status, "misconfigured");
    assert.deepEqual(partial.missing, [
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ]);
  });

  it("uses a safe root folder name", () => {
    const config = getCloudinaryConfig({
      ...COMPLETE_ENV,
      CLOUDINARY_FOLDER: "  Morgen Geschäft / Production  ",
    });
    assert.equal(config.rootFolder, "morgen-gesch-ft-production");
  });
});

describe("isAllowedUploadedImageUrl", () => {
  it("accepts safe local uploads and this Cloudinary account", () => {
    assert.equal(isAllowedUploadedImageUrl("/uploads/123_photo.webp", COMPLETE_ENV), true);
    assert.equal(
      isAllowedUploadedImageUrl(
        "https://res.cloudinary.com/morgen-cloud/image/upload/v123/morgen-geschaft/reviews/photo.jpg",
        COMPLETE_ENV,
      ),
      true,
    );
  });

  it("rejects traversal, insecure URLs, other accounts, and lookalike hosts", () => {
    assert.equal(isAllowedUploadedImageUrl("/uploads/../secret.txt", COMPLETE_ENV), false);
    assert.equal(
      isAllowedUploadedImageUrl(
        "http://res.cloudinary.com/morgen-cloud/image/upload/v1/photo.jpg",
        COMPLETE_ENV,
      ),
      false,
    );
    assert.equal(
      isAllowedUploadedImageUrl(
        "https://res.cloudinary.com/other-cloud/image/upload/v1/photo.jpg",
        COMPLETE_ENV,
      ),
      false,
    );
    assert.equal(
      isAllowedUploadedImageUrl(
        "https://res.cloudinary.com.evil.example/morgen-cloud/image/upload/v1/photo.jpg",
        COMPLETE_ENV,
      ),
      false,
    );
  });
});

describe("verifyCloudinaryConnection", () => {
  it("reports ready only after a successful authenticated ping", async () => {
    const { client, calls } = createCloudinaryClient();
    const status = await verifyCloudinaryConnection({
      env: COMPLETE_ENV,
      client,
    });

    assert.equal(status.status, "ready");
    assert.equal(calls.ping, 1);
    assert.equal(calls.config.length, 1);
  });

  it("reports disabled without credentials and error when ping fails", async () => {
    const disabled = await verifyCloudinaryConnection({ env: {} });
    assert.equal(disabled.status, "disabled");

    const { client } = createCloudinaryClient({
      api: {
        async ping() {
          throw new Error("unauthorized");
        },
      },
    });
    const failed = await verifyCloudinaryConnection({
      env: COMPLETE_ENV,
      client,
    });
    assert.equal(failed.status, "error");
    assert.equal(failed.lastError, "unauthorized");
  });
});

describe("deleteUploadedImage", () => {
  it("removes only images inside the configured root folder", async () => {
    const { client, calls } = createCloudinaryClient();
    const deleted = await deleteUploadedImage(
      "morgen-geschaft/returns/evidence-1",
      { env: COMPLETE_ENV, client },
    );
    const outsideRoot = await deleteUploadedImage("other-folder/photo", {
      env: COMPLETE_ENV,
      client,
    });

    assert.equal(deleted, true);
    assert.equal(outsideRoot, false);
    assert.equal(calls.destroy.length, 1);
    assert.equal(
      calls.destroy[0].publicId,
      "morgen-geschaft/returns/evidence-1",
    );
    assert.equal(calls.destroy[0].options.invalidate, true);
  });
});

describe("uploadImageWithFallback", () => {
  const file = {
    path: "/tmp/photo.webp",
    filename: "123_photo.webp",
  };

  it("uploads to Cloudinary and removes the temporary local file", async () => {
    const { client, calls } = createCloudinaryClient();
    const removed = [];
    const result = await uploadImageWithFallback(
      file,
      {
        folder: "admin",
        tags: ["morgen-geschaft", "admin-upload"],
      },
      {
        env: COMPLETE_ENV,
        client,
        removeFile: async (filePath) => removed.push(filePath),
      },
    );

    assert.equal(result.storage, "cloudinary");
    assert.match(result.url, /^https:\/\/res\.cloudinary\.com\//);
    assert.equal(result.publicId, "morgen-geschaft/admin/sample");
    assert.deepEqual(removed, [file.path]);
    assert.equal(calls.upload.length, 1);
    assert.equal(calls.upload[0].options.folder, "morgen-geschaft/admin");
    assert.equal(calls.upload[0].options.resource_type, "image");
  });

  it("keeps the local file when Cloudinary upload fails", async () => {
    let removed = false;
    const logs = [];
    const { client } = createCloudinaryClient({
      uploader: {
        async upload() {
          throw new Error("network unavailable");
        },
      },
    });

    const result = await uploadImageWithFallback(
      file,
      { folder: "reviews" },
      {
        env: COMPLETE_ENV,
        client,
        removeFile: async () => {
          removed = true;
        },
        logger: (...args) => logs.push(args),
      },
    );

    assert.equal(result.storage, "local");
    assert.equal(result.url, "/uploads/123_photo.webp");
    assert.equal(removed, false);
    assert.equal(logs.length, 1);
  });

  it("uses local storage without calling Cloudinary when credentials are absent", async () => {
    const { client, calls } = createCloudinaryClient();
    const result = await uploadImageWithFallback(
      file,
      { folder: "admin" },
      { env: {}, client },
    );

    assert.equal(result.storage, "local");
    assert.equal(calls.config.length, 0);
    assert.equal(calls.upload.length, 0);
  });
});
