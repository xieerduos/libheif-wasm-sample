# 使用 libheif 库解码 heic 图片

libheif 提供 在线预览的例子 https://strukturag.github.io/libheif/

## 在线预览体验

在线预览体验 https://docs.ffffee.com/wasm/libheif/index.html

最新文档 https://docs.ffffee.com/wasm/2-libheif-decode-heic-img.html

## 本地启动

```bash
npm install
```

```bash
npm start
```

http://localhost:8080

## 日志记录

### 1. 自己构建 wasm 或者使用 在线例子的 wasm

尝试构建失败了，故 这里使用它已经构建好的例子，通过修改例子源码得到我们自己的代码

### 2. 下载 libheif.js libheif.wasm

<a href="https://strukturag.github.io/libheif/libheif.wasm" target="_blank">https://strukturag.github.io/libheif/libheif.wasm</a>
<a href="https://strukturag.github.io/libheif/libheif.js" target="_blank">https://strukturag.github.io/libheif/libheif.js</a>

### 3. 修改 libheif.js 增加 whenReady Promise

```js{3-6, 8-10 }
var Module = typeof Module != "undefined" ? Module : {};
(function () {
  var resolveReady; // 添加
  var whenReady = new Promise(function (resolve) { // 添加
    resolveReady = resolve; // 添加
  }); // 添加
  var Module = {
    // ...
    onRuntimeInitialized: function () {
      // ...
      resolveReady(); // 添加
    },
  };

  var libheif = {
    HeifDecoder: HeifDecoder,
    fourcc: function (s) {
      return (
        (s.charCodeAt(0) << 24) |
        (s.charCodeAt(1) << 16) |
        (s.charCodeAt(2) << 8) |
        s.charCodeAt(3)
      );
    },
    whenReady, // 添加
  };
  delete this["Module"];
  // ...
});
```

### 4. 创建 index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>heif web worker sample</title>
    <style>
      html,
      body {
        margin: 0;
      }

      img {
        display: block;
        margin: 0 auto;
        max-width: 80vw;
        max-height: 80vh;
      }

      #upload {
        display: block;
        margin: 20px auto;
      }
    </style>
  </head>

  <body>
    <input type="file" id="upload" accept=".heic,.heif" />

    <div id="container"></div>

    <script>
      const heifWorker = new Worker("./heifWorker.js");
      const upload = document.getElementById("upload");
      const container = document.querySelector("#container");

      const handleRemoveImage = () => {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      };

      upload.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const fileUrl = URL.createObjectURL(file);
        handleRemoveImage();
        handleWasm(fileUrl);
      });

      window.onload = () => {
        handleRemoveImage();
        handleWasm("example1.heic");
      };

      function handleWasm(imgURL) {
        return useHeifWasm(imgURL)
          .then((dataUrl) => {
            const img = document.createElement("img");
            // 成功加载或加载失败都会释放对象 URL
            const onFinished = () => {
              URL.revokeObjectURL(dataUrl);
              URL.revokeObjectURL(imgURL);
            };
            img.onload = onFinished; // 成功加载
            img.onerror = onFinished; // 加载失败
            img.src = dataUrl;
            container.appendChild(img);
          })
          .catch((err) => {
            console.error("error", err);
          });
      }

      async function useHeifWasm(url, callback = () => {}) {
        try {
          return new Promise((resolve, reject) => {
            heifWorker.postMessage({ url });

            heifWorker.onmessage = function (message) {
              callback("decoding");

              if (message.data === "error") {
                console.error("Error occurred in worker");
                reject(new Error("Error occurred in worker"));
                return;
              }
              const dataUrl = message.data;

              resolve(dataUrl);
            };
          });
        } catch (error) {
          console.error("[useHeifWasm error]", error);
          throw error;
        }
      }
    </script>
  </body>
</html>
```

### 5. heifWorker.js

```js
importScripts("./libheif.js"); // eslint-disable-line
importScripts("./CanvasDrawer.js"); // eslint-disable-line

class HeifWrapper {
  constructor(libheif) {
    this.libheif = libheif;
    this.canvas = new OffscreenCanvas(0, 0);
    this.image_data = [];
    this.drawer = new CanvasDrawer(this.canvas); // eslint-disable-line
    this.decoder = new libheif.HeifDecoder();
  }

  loadBuffer(buffer, callback = () => {}) {
    return new Promise((resolve, reject) => {
      // 释放之前的图像数据
      this.image_data[0]?.free();

      this.image_data = this.decoder.decode(buffer);

      this.drawer.draw(this.image_data[0], async (response) => {
        if (response === "error-format") {
          reject(new Error({ message: "error-format" }));
          return;
        }
        if (response === "success") {
          try {
            console.time("OffscreenCanvas转成blob耗时");
            const blob = await this.drawer.canvas.convertToBlob(); // 使用 convertToBlob
            console.timeEnd("OffscreenCanvas转成blob耗时");
            resolve(URL.createObjectURL(blob));
            // const dataUrl = await this.blobToDataURL(blob); // 将 Blob 转换为 Data URL
            // resolve(dataUrl);
          } catch (error) {
            reject(error);
          }
        } else {
          callback(response);
        }
      });
    });
  }

  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error("Failed to convert Blob to Data URL"));
      };
      reader.readAsDataURL(blob);
    });
  }
}

libheif.whenReady.then(() => {
  console.log("heif.wasm 加载完成");
});

// console.log("libheif", libheif);

onmessage = async function (e) {
  try {
    const { url } = e.data;

    const uint8Array = await fetch(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => new Uint8Array(buffer));

    // 等待 libheif 加载完成
    await libheif.whenReady;

    console.time("解码耗时" + url);

    const heifWrapper = new HeifWrapper(libheif); // eslint-disable-line

    const dataUrl = await heifWrapper.loadBuffer(uint8Array);
    console.timeEnd("解码耗时" + url);
    postMessage(dataUrl);
  } catch (error) {
    console.error("[Worker Error]", error);
    postMessage("error", error); // 发送错误消息
  }
};
```

### 6. CanvasDrawer.js

```js
class CanvasDrawer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.image_data = null;
  }

  draw(image, callback) {
    try {
      const w = image.get_width();
      const h = image.get_height();

      if (
        w !== this.canvas.width ||
        h !== this.canvas.height ||
        !this.image_data
      ) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.image_data = this.ctx.createImageData(w, h);
        this.whiteOutImageData(w, h);
      }
      callback("decoding");

      image.display(this.image_data, (displayImageData) => {
        // 请注意，这里直接使用 performance.now()
        // console.log(`解码完成: ${performance.now() - startTime} milliseconds`);
        callback("decoding-completed");

        if (!displayImageData) {
          callback("error-format");
          return;
        }

        // 这里删除了使用 requestAnimationFrame 的逻辑，
        // 因为在 Worker 中它是不可用的。
        this.ctx.putImageData(displayImageData, 0, 0);
        callback("success"); // 在此处调用回调
      });
    } catch (error) {
      console.log("[CanvasDrawer error]", error);
    }
  }

  whiteOutImageData(w, h) {
    const imageData = this.image_data.data;
    for (let i = 0; i < w * h; i++) imageData[i * 4 + 3] = 255;
  }
}
```

## 本地运行

1. web 上运行，需要 使用 http/https 服务

```bash
npm install
```

```bash
npm start
```

2. electron 上运行，需要支持 自定义协议允许 fetch api

增加 `supportFetchAPI: true`

```js
// https://github.com/nklayman/vue-cli-plugin-electron-builder/issues/607#issuecomment-569469770
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { secure: true, supportFetchAPI: true, standard: true },
  },
]);
```
