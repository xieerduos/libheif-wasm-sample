class CanvasDrawer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image_data = null;
  }

  draw(image, callback) {
    try {
      const w = image.get_width();
      const h = image.get_height();

      if (w !== this.canvas.width || h !== this.canvas.height || !this.image_data) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.image_data = this.ctx.createImageData(w, h);
        this.whiteOutImageData(w, h);
      }
      callback('decoding');

      image.display(this.image_data, (displayImageData) => {
        // 请注意，这里直接使用 performance.now()
        // console.log(`解码完成: ${performance.now() - startTime} milliseconds`);
        callback('decoding-completed');

        if (!displayImageData) {
          callback('error-format');
          return;
        }

        // 这里删除了使用 requestAnimationFrame 的逻辑，
        // 因为在 Worker 中它是不可用的。
        this.ctx.putImageData(displayImageData, 0, 0);
        callback('success'); // 在此处调用回调
      });
    } catch (error) {
      console.log('[CanvasDrawer error]', error);
    }
  }

  whiteOutImageData(w, h) {
    const imageData = this.image_data.data;
    for (let i = 0; i < w * h; i++) imageData[i * 4 + 3] = 255;
  }
}
