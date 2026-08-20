/**
 * utils.js — সাধারণ helper functions
 *
 * Features:
 * - HTML escaping
 * - File size/date formatting
 * - Debounce
 * - HTML element creation
 * - Query string generation
 * - Toast notification
 * - File → Base64
 * - WebP encoding detection
 * - Image resize + compression
 * - EXIF orientation handling
 * - Small-file optimization
 * - PNG transparency preservation
 * - Thumbnail generation
 * - Upload image compression
 */


/* =========================================================
 * 1. HTML ESCAPE
 * ========================================================= */

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* =========================================================
 * 2. FILE SIZE FORMATTER
 * ========================================================= */

function formatBytes(bytes) {
  bytes = Number(bytes) || 0;

  if (bytes < 1024) {
    return bytes + ' B';
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}


/* =========================================================
 * 3. DATE FORMATTER
 * ========================================================= */

function formatDate(d) {
  if (!d) return '';

  var dt = new Date(d);

  if (isNaN(dt.getTime())) {
    return String(d);
  }

  var months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  var h = dt.getHours();
  var ampm = h >= 12 ? 'PM' : 'AM';

  h = h % 12;

  if (h === 0) {
    h = 12;
  }

  var mins = ('0' + dt.getMinutes()).slice(-2);

  return (
    dt.getDate() +
    '-' +
    months[dt.getMonth()] +
    '-' +
    dt.getFullYear() +
    ' ' +
    h +
    ':' +
    mins +
    ' ' +
    ampm
  );
}


/* =========================================================
 * 4. DEBOUNCE
 * ========================================================= */

function debounce(fn, ms) {
  var t;

  return function () {
    var args = arguments;
    var ctx = this;

    clearTimeout(t);

    t = setTimeout(function () {
      fn.apply(ctx, args);
    }, ms);
  };
}


/* =========================================================
 * 5. CREATE ELEMENT FROM HTML
 * ========================================================= */

function el(html) {
  var t = document.createElement('template');

  t.innerHTML = html.trim();

  return t.content.firstElementChild;
}


/* =========================================================
 * 6. QUERY STRING BUILDER
 * ========================================================= */

function qs(params) {
  return Object.keys(params)
    .filter(function (k) {
      return (
        params[k] !== undefined &&
        params[k] !== null &&
        params[k] !== ''
      );
    })
    .map(function (k) {
      return (
        encodeURIComponent(k) +
        '=' +
        encodeURIComponent(params[k])
      );
    })
    .join('&');
}


/* =========================================================
 * 7. TOAST NOTIFICATION
 * ========================================================= */

var Toast = (function () {
  var container;

  function ensure() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-stack';

      document.body.appendChild(container);
    }

    return container;
  }

  return {
    show: function (message, type) {
      var box = ensure();

      var safeType = String(type || 'info')
        .replace(/[^a-zA-Z0-9_-]/g, '');

      var t = el(
        '<div class="toast toast--' +
        safeType +
        '">' +
        escapeHtml(message) +
        '</div>'
      );

      box.appendChild(t);

      requestAnimationFrame(function () {
        t.classList.add('show');
      });

      setTimeout(function () {
        t.classList.remove('show');

        setTimeout(function () {
          if (t && t.parentNode) {
            t.remove();
          }
        }, 250);
      }, 3500);
    },

    error: function (message) {
      this.show(message, 'error');
    },

    success: function (message) {
      this.show(message, 'success');
    },

    info: function (message) {
      this.show(message, 'info');
    },

    warning: function (message) {
      this.show(message, 'warning');
    }
  };
})();


/* =========================================================
 * 8. FILE → BASE64
 * ========================================================= */

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();

    reader.onload = function () {
      var result = reader.result || '';

      var commaIndex = result.indexOf(',');

      if (commaIndex === -1) {
        reject(new Error('Invalid Data URL.'));
        return;
      }

      resolve(result.substring(commaIndex + 1));
    };

    reader.onerror = function () {
      reject(
        reader.error ||
        new Error('Unable to read file.')
      );
    };

    reader.readAsDataURL(file);
  });
}


/* =========================================================
 * 9. APPLICATION IMAGE CONFIGURATION
 * ========================================================= */

function getImageConfig_(type) {

  var defaults = {

    THUMBNAIL: {
      maxDim: 420,
      quality: 0.72
    },

    UPLOAD_IMAGE: {
      maxDim: 2000,
      quality: 0.85,

      /*
       * 300 KB-এর নিচের ছবি অযথা
       * re-compress করা হবে না।
       */
      minCompressBytes: 300 * 1024
    }
  };

  var appConfig =
    window.APP_CONFIG || {};

  var custom =
    appConfig[type] || {};

  var base =
    defaults[type] || {};

  var result = {};

  Object.keys(base).forEach(function (key) {
    result[key] = base[key];
  });

  Object.keys(custom).forEach(function (key) {
    if (
      custom[key] !== undefined &&
      custom[key] !== null
    ) {
      result[key] = custom[key];
    }
  });

  return result;
}


/* =========================================================
 * 10. WEBP ENCODING SUPPORT
 * ========================================================= */

var _webpSupported = null;

function supportsWebpEncoding_() {

  if (_webpSupported !== null) {
    return _webpSupported;
  }

  try {

    var canvas =
      document.createElement('canvas');

    canvas.width = 2;
    canvas.height = 2;

    var ctx =
      canvas.getContext('2d');

    if (!ctx) {
      _webpSupported = false;
      return _webpSupported;
    }

    ctx.fillStyle = '#ff0000';

    ctx.fillRect(
      0,
      0,
      2,
      2
    );

    var dataUrl =
      canvas.toDataURL(
        'image/webp',
        0.8
      );

    _webpSupported =
      dataUrl.indexOf(
        'data:image/webp'
      ) === 0;

  } catch (e) {

    _webpSupported = false;
  }

  return _webpSupported;
}


/* =========================================================
 * 11. CHECK IMAGE TRANSPARENCY
 * ========================================================= */

function hasTransparency_(
  ctx,
  width,
  height
) {

  try {

    var imageData =
      ctx.getImageData(
        0,
        0,
        width,
        height
      );

    var data =
      imageData.data;

    for (
      var i = 3;
      i < data.length;
      i += 4
    ) {

      if (data[i] < 255) {
        return true;
      }
    }

  } catch (e) {
    /*
     * If canvas access fails,
     * safely assume no transparency.
     */
  }

  return false;
}


/* =========================================================
 * 12. LOAD IMAGE WITH ORIENTATION SUPPORT
 * ========================================================= */

function loadImageWithOrientation_(file) {

  /*
   * Modern browser.
   */
  if (
    typeof createImageBitmap ===
    'function'
  ) {

    return createImageBitmap(
      file,
      {
        imageOrientation:
          'from-image'
      }
    )
      .then(function (bitmap) {

        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          bitmap: bitmap
        };

      })
      .catch(function () {

        return loadImageFallback_(file);
      });
  }

  /*
   * Older browser fallback.
   */
  return loadImageFallback_(file);
}


/* =========================================================
 * 13. STANDARD IMAGE LOADER FALLBACK
 * ========================================================= */

function loadImageFallback_(file) {

  return new Promise(function (resolve) {

    var url =
      URL.createObjectURL(file);

    var img =
      new Image();

    img.onload = function () {

      URL.revokeObjectURL(url);

      resolve({
        source: img,
        width:
          img.naturalWidth ||
          img.width,
        height:
          img.naturalHeight ||
          img.height,
        bitmap: null
      });
    };

    img.onerror = function () {

      URL.revokeObjectURL(url);

      resolve(null);
    };

    img.src = url;
  });
}


/* =========================================================
 * 14. RELEASE IMAGE RESOURCE
 * ========================================================= */

function closeImageSource_(loaded) {

  if (
    loaded &&
    loaded.bitmap &&
    typeof loaded.bitmap.close ===
      'function'
  ) {

    try {
      loaded.bitmap.close();
    } catch (e) {
      // Ignore cleanup error
    }
  }
}


/* =========================================================
 * 15. CANVAS → BASE64 OBJECT
 * ========================================================= */

function canvasToBase64Object_(
  canvas,
  mimeType,
  quality
) {

  try {

    var dataUrl;

    /*
     * PNG does not use quality.
     */
    if (
      mimeType ===
      'image/png'
    ) {

      dataUrl =
        canvas.toDataURL(
          'image/png'
        );

    } else {

      dataUrl =
        canvas.toDataURL(
          mimeType,
          quality
        );
    }

    if (!dataUrl) {
      return null;
    }

    var commaIndex =
      dataUrl.indexOf(',');

    if (commaIndex === -1) {
      return null;
    }

    return {
      base64:
        dataUrl.substring(
          commaIndex + 1
        ),

      mimeType:
        mimeType
    };

  } catch (e) {

    return null;
  }
}


/* =========================================================
 * 16. IMAGE RESIZE + COMPRESS
 * ========================================================= */

function resizeImageBase64_(
  file,
  maxDim,
  quality
) {

  if (
    !file ||
    !/^image\//i.test(
      file.type || ''
    )
  ) {

    return Promise.resolve(null);
  }

  return loadImageWithOrientation_(file)
    .then(function (loaded) {

      if (!loaded) {
        return null;
      }

      var w = loaded.width;
      var h = loaded.height;

      if (
        !w ||
        !h ||
        !isFinite(w) ||
        !isFinite(h)
      ) {

        closeImageSource_(loaded);

        return null;
      }


      /* -----------------------------------------
       * Calculate resize
       * ----------------------------------------- */

      var longestSide =
        Math.max(w, h);

      var scale =
        Math.min(
          1,
          maxDim / longestSide
        );

      var cw =
        Math.max(
          1,
          Math.round(w * scale)
        );

      var ch =
        Math.max(
          1,
          Math.round(h * scale)
        );


      /* -----------------------------------------
       * Create canvas
       * ----------------------------------------- */

      var canvas =
        document.createElement(
          'canvas'
        );

      canvas.width = cw;
      canvas.height = ch;

      var ctx =
        canvas.getContext(
          '2d',
          {
            alpha: true
          }
        );

      if (!ctx) {

        closeImageSource_(loaded);

        return null;
      }


      /*
       * High quality image resizing.
       */
      ctx.imageSmoothingEnabled =
        true;

      ctx.imageSmoothingQuality =
        'high';


      /* -----------------------------------------
       * Draw image
       * ----------------------------------------- */

      ctx.drawImage(
        loaded.source,
        0,
        0,
        cw,
        ch
      );


      /* -----------------------------------------
       * Check transparency
       * ----------------------------------------- */

      var sourceType =
        String(
          file.type || ''
        ).toLowerCase();

      var isPng =
        sourceType ===
        'image/png';

      var transparent =
        isPng &&
        hasTransparency_(
          ctx,
          cw,
          ch
        );


      /* -----------------------------------------
       * Select output format
       *
       * WebP available:
       *     → WebP
       *
       * WebP unavailable + transparent PNG:
       *     → PNG
       *
       * Otherwise:
       *     → JPEG
       * ----------------------------------------- */

      var useWebp =
        supportsWebpEncoding_();

      var mimeType;
      var ext;

      if (useWebp) {

        mimeType =
          'image/webp';

        ext =
          'webp';

      } else if (transparent) {

        mimeType =
          'image/png';

        ext =
          'png';

      } else {

        mimeType =
          'image/jpeg';

        ext =
          'jpg';
      }


      /* -----------------------------------------
       * Encode
       * ----------------------------------------- */

      var result =
        canvasToBase64Object_(
          canvas,
          mimeType,
          quality
        );


      /* -----------------------------------------
       * Cleanup
       * ----------------------------------------- */

      closeImageSource_(loaded);

      canvas.width = 1;
      canvas.height = 1;

      if (!result) {
        return null;
      }

      result.ext = ext;

      result.width = cw;

      result.height = ch;

      return result;

    })
    .catch(function () {

      return null;
    });
}


/* =========================================================
 * 17. THUMBNAIL GENERATOR
 * ========================================================= */

function makeThumbnail(file) {

  var cfg =
    getImageConfig_(
      'THUMBNAIL'
    );

  return resizeImageBase64_(
    file,
    cfg.maxDim,
    cfg.quality
  )
    .then(function (res) {

      if (!res) {
        return null;
      }

      return {
        base64:
          res.base64,

        mimeType:
          res.mimeType
      };
    });
}


/* =========================================================
 * 18. IMAGE UPLOAD COMPRESSION
 * ========================================================= */

function compressImageForUpload(
  file
) {

  if (!file) {

    return Promise.reject(
      new Error(
        'No file supplied.'
      )
    );
  }


  /* -----------------------------------------
   * Non-image files
   *
   * PDF / DOC / DOCX / XLS / XLSX etc.
   * remain unchanged.
   * ----------------------------------------- */

  if (
    !/^image\//i.test(
      file.type || ''
    )
  ) {

    return fileToBase64(file)
      .then(function (base64) {

        return {
          base64:
            base64,

          mimeType:
            file.type ||
            'application/octet-stream',

          fileName:
            file.name
        };
      });
  }


  var cfg =
    getImageConfig_(
      'UPLOAD_IMAGE'
    );


  /* -----------------------------------------
   * Small-file optimization
   * ----------------------------------------- */

  var minCompressBytes =
    Number(
      cfg.minCompressBytes
    ) || 0;


  return loadImageWithOrientation_(file)
    .then(function (loaded) {

      if (!loaded) {

        /*
         * Image decode failed.
         * Upload original file.
         */
        return fileToBase64(file)
          .then(function (base64) {

            return {
              base64:
                base64,

              mimeType:
                file.type ||
                'application/octet-stream',

              fileName:
                file.name
            };
          });
      }


      var w =
        loaded.width;

      var h =
        loaded.height;

      var longestSide =
        Math.max(w, h);


      /*
       * Check whether resize is required.
       */
      var needsResize =
        longestSide >
        cfg.maxDim;


      /*
       * IMPORTANT:
       *
       * If file is <= 300 KB and
       * dimensions are already within
       * maxDim, preserve original file.
       */
      if (
        file.size <=
          minCompressBytes &&
        !needsResize
      ) {

        closeImageSource_(
          loaded
        );

        return fileToBase64(file)
          .then(function (base64) {

            return {
              base64:
                base64,

              mimeType:
                file.type ||
                'application/octet-stream',

              fileName:
                file.name
            };
          });
      }


      closeImageSource_(
        loaded
      );


      /* -----------------------------------------
       * Resize + compress
       * ----------------------------------------- */

      return resizeImageBase64_(
        file,
        cfg.maxDim,
        cfg.quality
      )
        .then(function (res) {

          if (!res) {

            /*
             * Compression failed.
             * Original file is used as fallback.
             */
            return fileToBase64(file)
              .then(function (base64) {

                return {
                  base64:
                    base64,

                  mimeType:
                    file.type ||
                    'application/octet-stream',

                  fileName:
                    file.name
                };
              });
          }


          /*
           * Remove original extension.
           */
          var baseName =
            file.name.replace(
              /\.[^./\\]+$/,
              ''
            );


          /*
           * New filename according
           * to actual output format.
           */
          var newFileName =
            baseName +
            '.' +
            res.ext;


          return {
            base64:
              res.base64,

            mimeType:
              res.mimeType,

            fileName:
              newFileName
          };
        });
    });
}


/* =========================================================
 * 19. GET IMAGE INFORMATION
 * ========================================================= */

function getImageInfo(file) {

  if (
    !file ||
    !/^image\//i.test(
      file.type || ''
    )
  ) {

    return Promise.resolve(null);
  }

  return loadImageWithOrientation_(file)
    .then(function (loaded) {

      if (!loaded) {
        return null;
      }

      var result = {

        width:
          loaded.width,

        height:
          loaded.height,

        size:
          file.size,

        type:
          file.type,

        name:
          file.name
      };

      closeImageSource_(
        loaded
      );

      return result;
    });
}


/* =========================================================
 * 20. CHECK IMAGE FILE
 * ========================================================= */

function isImageFile(file) {

  return !!(
    file &&
    /^image\//i.test(
      file.type || ''
    )
  );
}


/* =========================================================
 * 21. APPLICATION CONFIGURATION
 *
 * You can override these values
 * from your existing application.
 * ========================================================= */

window.APP_CONFIG =
  window.APP_CONFIG || {};


/*
 * Thumbnail configuration
 */
window.APP_CONFIG.THUMBNAIL =
  Object.assign(
    {
      maxDim: 420,
      quality: 0.72
    },
    window.APP_CONFIG.THUMBNAIL || {}
  );


/*
 * Upload image configuration
 */
window.APP_CONFIG.UPLOAD_IMAGE =
  Object.assign(
    {
      maxDim: 2000,
      quality: 0.85,

      /*
       * 300 KB-এর নিচের ছবি
       * অযথা compress করবে না।
       */
      minCompressBytes:
        300 * 1024
    },
    window.APP_CONFIG.UPLOAD_IMAGE || {}
  );


/* =========================================================
 * END OF utils.js
 * ========================================================= */
