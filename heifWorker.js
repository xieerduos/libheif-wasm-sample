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
