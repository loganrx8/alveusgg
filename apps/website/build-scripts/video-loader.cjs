// @ts-nocheck
const { tmpdir } = require("os");
const { randomBytes } = require("crypto");
const { join, dirname } = require("path");
const { exec: execSync } = require("child_process");
const {
  readFile,
  mkdir,
  readdir,
  stat,
  unlink,
  copyFile,
} = require("fs/promises");
const { interpolateName, getHashDigest } = require("loader-utils");
const ffmpeg = require("@ffmpeg-installer/ffmpeg");
const ffprobe = require("@ffprobe-installer/ffprobe");

/**
 * @typedef {Object} VideoLoaderOptions
 * @property {string} [quality] Default video quality
 * @property {boolean} isServer Is the loader being run for the server build
 * @property {boolean} isDevelopment Is the loader being run in development mode
 * @property {string} assetPrefix Asset directory prefix
 */

/**
 * @typedef {Object} VideoLoaderContext
 * @property {import("webpack").LoaderContext<VideoLoaderOptions>} context Webpack compilation context
 * @property {string} format Output filename format
 * @property {Buffer} content Input video content
 * @property {boolean} isServer Is the loader being run for the server build
 * @property {string} cache Directory to cache the resized video in
 */

/**
 * @typedef {Object} VideoLoaderOutput
 * @property {string} name Output filename
 * @property {Buffer | null} content Output video content
 * @property {number} [height] Output video height
 * @property {string} [type] Output video mime type
 * @property {boolean} cached Whether the output was cached
 * @property {boolean} skipped Whether the video processing was skipped
 */

/**
 * Run a shell command
 *
 * @param {string} command Command to run
 * @return {Promise<{ stdout: string, stderr: string }>}
 */
const exec = (command) =>
  new Promise((resolve, reject) => {
    execSync(command, (error, stdout, stderr) => {
      if (error) reject({ error, stdout, stderr });
      else resolve({ stdout, stderr });
    });
  });

/** @type {import("file-type")} */
let fileTypeCache;

/**
 * Get the file type of a buffer
 *
 * @param {Buffer} buffer Buffer to get the file type of
 * @return {Promise<ReturnType<import("file-type").fileTypeFromBuffer>>}
 */
const fileType = async (buffer) => {
  if (!fileTypeCache) fileTypeCache = await import("file-type");
  return fileTypeCache.fileTypeFromBuffer(buffer);
};

const cacheDir = "./.next/cache/video-loader";

/**
 * Get the raw video data
 *
 * @param {VideoLoaderContext} ctx Video loader context
 * @return {Promise<VideoLoaderOutput>}
 */
const videoRaw = async (ctx) => {
  // Use ffprobe to get the height
  const { stdout } = await exec(
    `"${ffprobe.path}" -v error -select_streams v:0 -show_entries stream=height -of json "${ctx.context.resourcePath}"`,
  );
  const { height } = JSON.parse(stdout).streams[0];

  // Use file-type to get the mime type
  const { mime } = (await fileType(ctx.content)) || {};
  if (!mime) throw new Error("Could not determine mime type");

  // Get the formatted name
  const interpolatedName = interpolateName(ctx.context, ctx.format, {
    content: ctx.content,
  });

  return {
    name: interpolatedName,
    content: ctx.content,
    height,
    type: mime,
    cached: false,
    skipped: true,
  };
};

/**
 * Get a scale filter for ffmpeg
 *
 * One of width or height must be set
 *
 * @param {number} [width] Optional width for the filter
 * @param {number} [height] Optional height for the filter
 * @return {`-filter:v "scale=${string}:${string}"`}
 */
const scaleFilter = (width = undefined, height = undefined) => {
  if (width === undefined && height === undefined)
    throw new Error("One of width or height must be set");

  const widthFilter = width
    ? Math.round(Number(width) / 2) * 2
    : "trunc(oh*a/2)*2";
  const heightFilter = height
    ? Math.round(Number(height) / 2) * 2
    : "trunc(ow/a/2)*2";
  return `-filter:v "scale=w=${widthFilter}:h=${heightFilter}"`;
};

/**
 * Get a resized version of the video
 *
 * @param {VideoLoaderContext} ctx Video loader context
 * @param {string} [extension] Optional output extension (will default to input extension)
 * @param {number} [width] Optional width for the filter
 * @param {number} [height] Optional height for the filter
 * @param {string[]} [args=[]] Additional arguments to pass to ffmpeg
 * @param {string[]} [iargs=[]] Additional arguments to pass to ffmpeg (before the input file)
 * @return {Promise<VideoLoaderOutput>}
 */
const videoResized = async (
  ctx,
  { extension = undefined, width = undefined, height = undefined },
  args = [],
  iargs = [],
) => {
  // Get the original extension
  const originalExtension = interpolateName(ctx.context, "[ext]", {
    context: ctx.context.rootContext,
  });
  const processedExtension = extension || originalExtension;

  // Only process the video if we're on the client
  // See `videoLoader` for context on why we don't emit files for the server
  let resized = null;
  let cached = false;
  if (!ctx.isServer) {
    // Determine the cache key
    const cacheKey = getHashDigest(
      Buffer.from(
        [
          "video-loader",
          ctx.context.resourcePath,
          width,
          height,
          ...args,
          ...iargs,
          getHashDigest(ctx.content, "sha1"),
        ].join(":"),
      ),
      "sha1",
    );
    const cacheFile = `${ctx.cache}/${cacheKey}.${processedExtension}`;

    // See if the cache exists
    const cacheData = await readFile(cacheFile).catch(() => null);
    if (cacheData) {
      resized = cacheData;
      cached = true;
    } else {
      // Get a temporary file that we're outputting to
      const tmpFile = join(
        tmpdir(),
        `${randomBytes(16).toString("hex")}.${processedExtension}`,
      );

      // Determine the scale filter
      const scale = width || height ? scaleFilter(width, height) : "";

      // Use ffmpeg to change the size to what is requested
      const command = [
        `"${ffmpeg.path}"`,
        ...iargs,
        "-i",
        `"${ctx.context.resourcePath}"`,
        scale,
        ...args,
        "-n",
        `"${tmpFile}"`,
      ]
        .filter(Boolean)
        .join(" ");
      await exec(command).catch(({ error, stdout, stderr }) => {
        console.error("ffmpeg command failed:", command);
        console.error("stdout:", stdout);
        console.error("stderr:", stderr);
        throw error;
      });

      // Read in the temporary file
      resized = await readFile(tmpFile);

      // Move the temporary file to the cache
      await mkdir(dirname(cacheFile), { recursive: true });
      await copyFile(tmpFile, cacheFile);
      await unlink(tmpFile);
    }
  }

  // Get the original name
  const name = interpolateName(ctx.context, "[name]", {
    context: ctx.context.rootContext,
  });

  // Get the output name
  // Use the input content hash, so it's consistent between server and client
  const interpolatedName = interpolateName(ctx.context, ctx.format, {
    context: ctx.context.rootContext,
    content: ctx.content,
  })
    .replace(`${name}.`, `${name}-${width || ""}x${height || ""}.`)
    .replace(`.${originalExtension}`, `.${processedExtension}`);

  return {
    name: interpolatedName,
    content: resized,
    cached,
    skipped: ctx.isServer,
  };
};

/**
 * Get the requested quality from the resource query, or the default options
 *
 * @param {{ quality: string | null }} options Webpack loader options
 * @param {string} query Resource query
 * @return {string | null}
 */
const getQuality = (options, query) => {
  if (typeof query === "string" && query[0] === "?") {
    const params = new URLSearchParams(query.slice(1));
    const quality = params.get("quality");
    if (typeof quality === "string") return quality;
  }

  return typeof options.quality === "string" ? options.quality : null;
};

const defaultTypes = {
  high: [
    // Heavily compressed h264 720p30 video (no audio)
    {
      size: 720,
      type: "video/mp4",
      ext: "mp4",
      args: ["-an", "-vcodec libx264", "-filter:v fps=30", "-b:v 1200k"],
      iargs: [],
    },
  ],
  low: [
    // Heavily compressed h264 540p24 video (no audio)
    {
      size: 540,
      type: "video/mp4",
      ext: "mp4",
      args: ["-an", "-vcodec libx264", "-filter:v fps=24", "-b:v 800k"],
      iargs: [],
    },
  ],
  poster: [
    // First frame at 720p
    {
      size: 720,
      type: "video/mp4",
      ext: "png",
      args: ["-an", "-vframes 1"],
      iargs: [],
    },
    {
      size: 720,
      type: "video/webm",
      ext: "png",
      args: ["-an", "-vframes 1"],
      iargs: ["-vcodec libvpx-vp9"],
    },
  ],
};

/**
 * @typedef {Object} VideoLoaderResult
 * @property {string} output Output video content
 * @property {{ cached: number, skipped: number, total: number }} stats Stats on the video processing
 */

/**
 * Run the video loader
 *
 * @param {VideoLoaderContext["context"]} context Webpack compilation context
 * @param {Buffer} content Input video content
 * @return {Promise<VideoLoaderResult>}
 */
const videoLoader = async (context, content) => {
  console.log(`Processing video ${context.resourcePath} ...`);

  // Get the prefix for the output files
  // Based on https://github.com/vercel/next.js/blob/888384c5e853ee5f9988b74b9085f1d6f80157a3/packages/next/src/build/webpack/loaders/next-image-loader/index.ts#L25
  const options = context.getOptions();
  const base = `${options.assetPrefix}/_next`;

  // Get the quality
  const quality =
    getQuality(options, context.resourceQuery) || Object.keys(defaultTypes)[0];
  if (!Object.keys(defaultTypes).includes(quality))
    throw new Error(`Invalid quality: ${quality}`);

  // Create the context and objects to track the files
  const ctx = {
    context,
    format: "/static/media/[name].[hash:8].[ext]",
    content,
    isServer: options.isServer,
    cache: cacheDir,
  };
  const files = [];
  /** @typedef {{ src: string, size: int, type: string }} Source */
  /** @type {{ poster: string | undefined, sources: Array<Source> }} */
  const obj = { poster: undefined, sources: [] };

  // Load the raw video so we know the type
  const raw = await videoRaw(ctx);

  // Expose the first frame as a poster at 720p
  const posterOpts = defaultTypes.poster.find(({ type }) => type === raw.type);
  if (posterOpts) {
    const poster = await videoResized(
      ctx,
      { height: posterOpts.size, extension: posterOpts.ext },
      posterOpts.args,
      posterOpts.iargs,
    );
    files.push(poster);
    obj.poster = `${base}${poster.name}`;
  } else {
    console.warn(
      ` ... ${context.resourcePath} no poster options for ${raw.type}`,
    );
  }

  // When not in development mode, process the video
  if (!options.isDevelopment) {
    const resizeOpts = defaultTypes[quality].filter(
      ({ type }) => type === raw.type,
    );
    if (resizeOpts.length) {
      for (const { size, type, ext, args, iargs } of resizeOpts) {
        const video = await videoResized(
          ctx,
          { height: size, extension: ext },
          args,
          iargs,
        );
        files.push(video);
        obj.sources.push({
          src: `${base}${video.name}`,
          size,
          type,
        });
      }
    } else {
      console.warn(
        ` ... ${context.resourcePath} no resize options for ${raw.type}, using raw`,
      );
    }
  }

  // Otherwise, just expose the original video
  if (!obj.sources.length) {
    files.push(raw);
    obj.sources.push({
      src: `${base}${raw.name}`,
      size: raw.height,
      type: raw.type,
    });
  }

  // Emit the files
  // Based on https://github.com/vercel/next.js/blob/888384c5e853ee5f9988b74b9085f1d6f80157a3/packages/next/src/build/webpack/loaders/next-image-loader/index.ts#L66-L74
  // We don't emit for the server as videos are considered traceable and this breaks things (see https://github.com/vercel/next.js/pull/41554/files)
  if (!options.isServer) {
    files.forEach(
      ({ name, content }) => content && context.emitFile(name, content),
    );
  }

  // Collect stats on cache/skipped files
  const stats = files.reduce(
    (acc, { cached, skipped }) => ({
      cached: acc.cached + (cached ? 1 : 0),
      skipped: acc.skipped + (skipped ? 1 : 0),
      total: acc.total + 1,
    }),
    { cached: 0, skipped: 0, total: 0 },
  );

  // Return the object with the paths
  return {
    output: `export default ${JSON.stringify(obj)};`,
    stats,
  };
};

/**
 * @type {[VideoLoaderContext["context"], Buffer, { resolve: Function, reject: Function }][]}
 */
const queue = [];
let processing = false;

/**
 * Process the pending video queue
 */
const queueProcess = async () => {
  if (processing) return;
  processing = true;
  console.log("Processing video queue ...");

  while (queue.length) {
    const [context, content, { resolve, reject }] = queue.shift();
    try {
      const res = await videoLoader(context, content);
      resolve(res);
    } catch (e) {
      reject(e);
    }
  }

  processing = false;
  console.log(" ... video queue processed");
};

/**
 * Run the video loader
 *
 * @param {VideoLoaderContext["context"]} context Webpack compilation context
 * @param {Buffer} content Input video content
 * @return {Promise<VideoLoaderResult>}
 */
const queueVideo = async (context, content) => {
  console.log(`Queueing video ${context.resourcePath} ...`);

  // Create a promise to represent this video processing
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // Add the context to the queue
  queue.push([context, content, { resolve, reject }]);

  // Process the queue in the background
  queueProcess();
  return promise;
};

/**
 * Webpack hook to clean up old cache files
 *
 * @return {Promise<void>}
 */
const cacheCleanup = async () => {
  // Get all files in the cache dir
  const cacheFiles = await readdir(cacheDir, { withFileTypes: true })
    .then((file) => file.filter((f) => f.isFile()).map((f) => f.name))
    .catch(() => []);

  // Remove all files last accessed over 24 hours ago
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  await Promise.all(
    cacheFiles.map(async (file) => {
      const { atimeMs } = await stat(join(cacheDir, file));
      if (atimeMs < cutoff) await unlink(join(cacheDir, file));
    }),
  );
};

/**
 * @type {import("webpack").RawLoaderDefinition<VideoLoaderOptions, {}>}
 */
module.exports = function (content) {
  const callback = this.async();
  queueVideo(this, content)
    .then((res) => {
      console.log(
        ` ... ${this.resourcePath} completed (${res.stats.cached}/${res.stats.total} cached, ${res.stats.skipped}/${res.stats.total} skipped)`,
      );
      callback(null, res.output);
    })
    .catch((e) => {
      console.error(` ... ${this.resourcePath} failed`, e);
      callback(e);
    });

  // If our cleanup hook isn't already registered, register it
  if (
    this._compiler &&
    !this._compiler.hooks.afterEmit.taps.some((t) => t.fn === cacheCleanup)
  ) {
    this._compiler.hooks.afterEmit.tapPromise(
      "VideoLoaderCleanup",
      cacheCleanup,
    );
  }
};

module.exports.raw = true;
