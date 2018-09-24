const TILE_SIZE = 70;

ImageData.prototype.getAt = function (x, y) {
    const idx = (y * this.width + x) * 4;
    return this.data.slice(idx, idx + 4);
};

ImageData.prototype.getSub = function (size, tx, ty) {
    const startX = tx * size;
    const startY = ty * size;
    const endY = startY + size;
    const data = [];
    for (let y = startY; y < endY; y += 1) {
        const idx = (y * this.width + startX) * 4;
        data.push.apply(data, this.data.slice(idx, idx + size * 4));
    }
    return new ImageData(Uint8ClampedArray.from(data), size, size);
};

ImageData.prototype.slice = function (size, max = -1) {
    const tx = Math.floor(this.width / size);
    const ty = Math.floor(this.height / size);
    const ret = [];
    for (let y = 0; y < ty; y += 1) {
        for (let x = 0; x < tx; x += 1) {
            if (max < 0 || x * ty + y < max) {
                ret.push(this.getSub(size, x, y));
            }
        }
    }
    return ret;
};

ImageData.prototype.calculateHashs = function () {
    const w = this.width;
    const hw = Math.floor(w / 2);
    const h = this.height;
    const hh = Math.floor(h / 2);
    const topLeft = this.getAt(0, 0);
    const top = this.getAt(hw, 0);
    const topRight = this.getAt(w - 1, 0);
    const left = this.getAt(0, hh);
    const right = this.getAt(w - 1, hh);
    const bottomLeft = this.getAt(0, h - 1);
    const bottom = this.getAt(hw, h - 1);
    const bottomRight = this.getAt(w - 1, h - 1);
    this.hashs = [
        hashColorArray([topLeft, top, topRight]),
        hashColorArray([topLeft, left, bottomLeft]),
        hashColorArray([bottomLeft, bottom, bottomRight]),
        hashColorArray([topRight, right, bottomRight])
    ];
};

ImageData.prototype.compareHashs = function (other, rx, ry) {
    let idx = -1;
    if (rx === -1) {
        idx = 1;
    } else if (ry === -1) {
        idx = 2;
    } else if (rx === 1) {
        idx = 3;
    } else if (ry === 1) {
        idx = 0;
    }
    const otherIdx = (idx + 2) % 4;
    return compareColorHashArrays(this.hashs[idx], other.hashs[otherIdx]);
};

Math.randomInt = function (max) {
    return Math.floor(Math.random() * max);
};

Array.prototype.random = function () {
    return this[Math.randomInt(this.length)];
};

function compareColorHashArrays(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i += 1) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}

function hashColorArray(array) {
    return array.map(function (color) {
        let hash = '';
        for (let i = 0; i < color.length; i += 1) {
            hash += ('00' + color[i].toString(16)).substr(-2);
        }
        return hash;
    });
}

async function wfc(tiles, width, height, callback=null) {

    const wave = [];

    if (callback) {
        callback(wave);
    }

    async function collapse(idx) {
        const tiles = wave[idx];
        const tileIdx = Math.randomInt(tiles.length);
        tiles.splice(0, tileIdx);
        tiles.splice(1, tiles.length - 1);
        const x = idx % width;
        const y = Math.floor(idx / height);
        await propagate(x, y - 1, x, y);
        await propagate(x, y + 1, x, y);
        await propagate(x - 1, y, x, y);
        await propagate(x + 1, y, x, y);
    }

    async function propagate(x, y, sourceX, sourceY) {
        if (x < 0 || y < 0 || x >= width || y >= height)
            return;
        const idx = y * width + x;
        const sourceIdx = sourceY * width + sourceX;
        let matches = [];
        let tiles = wave[idx];
        let sourceTiles = wave[sourceIdx];
        if (sourceTiles.length === 0) return;
        for (let i = 0; i < tiles.length; i += 1) {
            for (let j = 0; j < sourceTiles.length; j += 1) {
                if (tiles[i].compareHashs(sourceTiles[j], -(x - sourceX), y - sourceY)) {
                    matches.push(tiles[i]);
                    break;
                }
            }
        }
        if (matches.length === tiles.length)
            return;
        wave[idx] = matches;
        await new Promise(resolve => setTimeout(resolve, 20));
        await propagate(x, y - 1, x, y);
        await propagate(x, y + 1, x, y);
        await propagate(x - 1, y, x, y);
        await propagate(x + 1, y, x, y);
    }

    for (let i = 0; i < width * height; i += 1) {
        wave.push(tiles.slice());
    }

    for (let tries = width * height; tries > 0; tries -= 1) {
        let minEntropy = 0;
        let idxArray = [];
        for (let i = 0; i < wave.length; i += 1) {
            const entropy = wave[i].length - 1;
            if (entropy > 0 && (entropy < minEntropy || minEntropy === 0)) {
                minEntropy = entropy;
                idxArray = [i];
            } else if (entropy === minEntropy) {
                idxArray.push(i);
            }
        }
        console.log(minEntropy);
        if (minEntropy === 0)
            break;
        const idx = idxArray.random();
        await collapse(idx);
    }
    console.log(wave);
    return wave;
}

window.onload = function () {
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');

    const image = new Image();
    image.src = 'img/sheet.png';

    image.onload = function () {

        canvas.width = image.width;
        canvas.height = image.height;

        context.drawImage(image, 0, 0);

        const imageData = context.getImageData(0, 0, image.width, image.height);
        const tiles = imageData.slice(TILE_SIZE, 36);
        tiles.forEach(function (tile) {
            tile.calculateHashs();
        });

        const MAP_W = 16;
        const MAP_H = 16;

        wfc(tiles, MAP_W, MAP_H, function (map) {
            setInterval(function () {

                canvas.width = MAP_W * TILE_SIZE;
                canvas.height = MAP_H * TILE_SIZE;

                for (let x = 0; x < MAP_W; x += 1) {
                    for (let y = 0; y < MAP_H; y += 1) {
                        const locals = map[x + y * MAP_W];
                        if (locals && locals.length > 0) {
                            context.putImageData(locals[0], x * TILE_SIZE, y * TILE_SIZE);
                        }
                    }
                }

            }, 10);
        });
    };
};