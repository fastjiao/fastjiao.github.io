/**
 * 照片墙JavaScript文件
 * 文件路径: photo_wall.js
 * 说明: 包含照片墙的所有业务逻辑模块
 * 版本: 1.1.0
 * 更新日期: 2026-08-18
 * 更新内容: 新增背景缩放、视图切换、批量上传、编辑选项卡功能
 */

/* ============================================
   配置常量定义
   ============================================ */

/**
 * 全局配置常量
 */
const CONFIG = {
    STORAGE_KEY: 'photo_wall_data',           // LocalStorage存储键名
    BACKUP_VERSION: '1.1.0',                  // 备份文件版本号（更新为1.1.0）
    MAX_FILE_SIZE: 10 * 1024 * 1024,         // 最大文件大小 10MB
    MAX_CAPTION_LENGTH: 50,                   // 最大文字长度
    DEFAULT_BACKGROUND: '#F5F5F5',           // 默认背景颜色
    PRESET_COLORS: [                          // 预设背景颜色
        '#F5F5F5',  // 浅灰色
        '#FFF5C0',  // 淡黄色
        '#E8F4F8',  // 淡蓝色
        '#F0E6F6'   // 淡紫色
    ],
    // 背景缩放配置
    MIN_SCALE: 0.5,                           // 最小缩放比例
    MAX_SCALE: 2.0,                           // 最大缩放比例
    SCALE_STEP: 0.1,                         // 缩放步长
    // 书架模式配置
    SHELF_COLUMNS: 4,                        // 书架模式列数
    SHELF_GAP: 20,                            // 书架模式间距
    // 批量上传配置
    EDGE_MARGIN: 50,                         // 边缘布局边距
    MAX_OVERLAP_RATIO: 0.1,                  // 最大重叠比例10%
    // 编辑选项卡配置
    TAB_WIDTH: 280,                          // 选项卡宽度
    MAX_LOCATION_LENGTH: 100                 // 地点最大长度
};

/* ============================================
   数据管理模块 (DataManager) - 已更新
   ============================================ */

/**
 * 数据管理模块 - 负责LocalStorage数据持久化和备份导出导入
 */
const DataManager = {
    /**
     * 保存照片数据到LocalStorage
     * @param {Array} photos - 照片卡片数组
     * @param {Object} background - 背景设置
     * @returns {boolean} 保存是否成功
     */
    save: function(photos, background) {
        try {
            const data = {
                version: CONFIG.BACKUP_VERSION,
                photos: photos,
                background: background,
                viewMode: ViewModeManager.currentMode || 'photo_wall'
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('保存数据失败:', e);
            return false;
        }
    },
    
    /**
     * 从LocalStorage读取数据
     * @returns {Object} { photos: [], background: { backgroundColor, backgroundScale }, viewMode: 'photo_wall' }
     */
    load: function() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                // 旧版本数据兼容迁移
                const photos = (parsed.photos || []).map(function(photo) {
                    return DataManager.migratePhotoData(photo);
                });
                return {
                    photos: photos,
                    background: {
                        backgroundColor: (parsed.background && parsed.background.backgroundColor) || CONFIG.DEFAULT_BACKGROUND,
                        backgroundScale: (parsed.background && parsed.background.backgroundScale) || 1.0
                    },
                    viewMode: parsed.viewMode || 'photo_wall'
                };
            }
            return { 
                photos: [], 
                background: { 
                    backgroundColor: CONFIG.DEFAULT_BACKGROUND,
                    backgroundScale: 1.0
                },
                viewMode: 'photo_wall'
            };
        } catch (e) {
            console.error('读取数据失败:', e);
            return { 
                photos: [], 
                background: { 
                    backgroundColor: CONFIG.DEFAULT_BACKGROUND,
                    backgroundScale: 1.0
                },
                viewMode: 'photo_wall'
            };
        }
    },
    
    /**
     * 迁移旧版本照片数据到新版本
     * @param {Object} photo - 旧版本照片数据
     * @returns {Object} 新版本照片数据
     */
    migratePhotoData: function(photo) {
        // 添加新字段并设置默认值
        return {
            id: photo.id || 'photo_' + Date.now(),
            imageUrl: photo.imageUrl || '',
            caption: photo.caption || '点击编辑文字',
            positionX: photo.positionX || 0,
            positionY: photo.positionY || 0,
            rotation: photo.rotation || 0,
            zIndex: photo.zIndex || 1,
            createdAt: photo.createdAt || new Date().toISOString(),
            // 新增字段
            time: photo.time || '',
            location: photo.location || '',
            originalPositionX: photo.originalPositionX || photo.positionX || 0,
            originalPositionY: photo.originalPositionY || photo.positionY || 0,
            originalRotation: photo.originalRotation || photo.rotation || 0
        };
    },
};

/* ============================================
   照片上传模块 (UploadManager) - 已更新
   ============================================ */

/**
 * 上传管理模块 - 处理点击/拖拽/粘贴三种上传方式，支持批量上传
 */
const UploadManager = {
    // 当前处理的卡片元素
    currentCard: null,
    
    // 边缘布局方向
    edgeDirections: ['top', 'bottom', 'left', 'right', 'top-right', 'top-left', 'bottom-right', 'bottom-left'],
    
    /**
     * 初始化上传模块
     */
    init: function() {
        // 1. 绑定"贴一张照片"按钮点击事件
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        
        uploadBtn.addEventListener('click', function() {
            fileInput.click();
        });
        
        // 支持多文件选择
        fileInput.setAttribute('multiple', 'multiple');
        
        fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                UploadManager.handleMultipleFiles(e.target.files);
            }
        });
        
        // 2. 监听照片墙区域的 drag/drop 事件
        const photoWall = document.getElementById('photoWall');
        
        photoWall.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        
        photoWall.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            UploadManager.handleDragDrop(e);
        });
        
        // 3. 监听 document 的 paste 事件
        document.addEventListener('paste', function(e) {
            UploadManager.handlePaste(e);
        });
    },
    
    /**
     * 处理多个文件选择
     * @param {FileList} files - 文件列表
     */
    handleMultipleFiles: function(files) {
        const total = files.length;
        let successCount = 0;
        let failCount = 0;
        let processed = 0;
        
        // 显示进度提示
        UploadManager.showUploadProgress(0, total);
        
        Array.from(files).forEach(function(file, index) {
            setTimeout(function() {
                const validation = UploadManager.validateFile(file);
                if (validation.valid) {
                    UploadManager.readFileAsBase64(file).then(function(base64) {
                        UploadManager.createPhotoCard(base64);
                        successCount++;
                        processed++;
                        UploadManager.showUploadProgress(processed, total);
                        if (processed === total) {
                            UploadManager.showUploadResult(successCount, failCount, total);
                        }
                    }).catch(function() {
                        failCount++;
                        processed++;
                        UploadManager.showUploadProgress(processed, total);
                        if (processed === total) {
                            UploadManager.showUploadResult(successCount, failCount, total);
                        }
                    });
                } else {
                    failCount++;
                    processed++;
                    UploadManager.showUploadProgress(processed, total);
                    if (processed === total) {
                        UploadManager.showUploadResult(successCount, failCount, total);
                    }
                }
            }, index * 100); // 错开处理时间，避免卡顿
        });
    },
    
    /**
     * 创建照片卡片
     * @param {string} base64 - Base64编码的图片数据
     */
    createPhotoCard: function(base64) {
        const photoData = {
            id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            imageUrl: base64,
            caption: '点击编辑文字',
            positionX: 0,
            positionY: 0,
            rotation: 0,
            zIndex: PhotoCardManager.getNextZIndex(),
            createdAt: new Date().toISOString(),
            // 新字段
            time: '',
            location: '',
            originalPositionX: 0,
            originalPositionY: 0,
            originalRotation: 0
        };
        
        // 生成边缘随机位置
        const photoWall = document.getElementById('photoWall');
        const wallRect = photoWall.getBoundingClientRect();
        const pos = UploadManager.generateEdgePosition(
            wallRect.width - 280,
            wallRect.height - 320
        );
        
        // 检测重叠，如果不合适重新生成
        let maxAttempts = 10;
        while (maxAttempts > 0) {
            const overlap = UploadManager.checkOverlap(pos, wallRect);
            if (!overlap) {
                break;
            }
            pos = UploadManager.generateEdgePosition(
                wallRect.width - 280,
                wallRect.height - 320
            );
            maxAttempts--;
        }
        
        photoData.positionX = pos.x;
        photoData.positionY = pos.y;
        photoData.originalPositionX = pos.x;
        photoData.originalPositionY = pos.y;
        photoData.rotation = PhotoCardManager.generateRandomRotation();
        photoData.originalRotation = photoData.rotation;
        
        const card = PhotoCardManager.create(photoData);
        photoWall.appendChild(card);
        
        // 保存到LocalStorage
        saveAllData();
        
        // 更新照片计数
        updatePhotoCount();
    },
    
    /**
     * 处理文件选择（单个文件）
     * @param {File} file - 图片文件
     */
    handleFileSelect: function(file) {
        const validation = UploadManager.validateFile(file);
        if (!validation.valid) {
            showToast(validation.error, 'error');
            return;
        }
        
        UploadManager.readFileAsBase64(file).then(function(base64) {
            UploadManager.createPhotoCard(base64);
            showToast('照片上传成功', 'success');
        }).catch(function(err) {
            showToast('图片读取失败', 'error');
        });
    },
    
    /**
     * 处理拖拽上传
     * @param {DragEvent} e - 拖拽事件
     */
    handleDragDrop: function(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            UploadManager.handleMultipleFiles(files);
        }
    },
    
    /**
     * 处理粘贴上传
     * @param {ClipboardEvent} e - 粘贴事件
     */
    handlePaste: function(e) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    UploadManager.handleFileSelect(file);
                }
                break;
            }
        }
    },
    
    /**
     * 校验文件格式和大小
     * @param {File} file - 图片文件
     * @returns {Object} { valid: boolean, error: string }
     */
    validateFile: function(file) {
        // 校验格式
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return { valid: false, error: '不支持的图片格式，请上传JPG、PNG、GIF或WebP格式的图片' };
        }
        
        // 校验大小
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            return { valid: false, error: '图片大小不能超过10MB' };
        }
        
        return { valid: true, error: '' };
    },
    
    /**
     * 读取文件为Base64编码
     * @param {File} file - 图片文件
     * @returns {Promise<string>} Base64编码的图片数据
     */
    readFileAsBase64: function(file) {
        return new Promise(function(resolve, reject) {
            const reader = new FileReader();
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            reader.onerror = function() {
                reject(new Error('文件读取失败'));
            };
            reader.readAsDataURL(file);
        });
    },
    
    /**
     * 生成边缘随机位置
     * @param {number} maxX - 最大水平位置
     * @param {number} maxY - 最大垂直位置
     * @returns {Object} { x: number, y: number }
     */
    generateEdgePosition: function(maxX, maxY) {
        const direction = UploadManager.edgeDirections[Math.floor(Math.random() * UploadManager.edgeDirections.length)];
        let x, y;
        
        switch (direction) {
            case 'top':
                x = Math.floor(Math.random() * maxX);
                y = CONFIG.EDGE_MARGIN;
                break;
            case 'bottom':
                x = Math.floor(Math.random() * maxX);
                y = maxY - CONFIG.EDGE_MARGIN;
                break;
            case 'left':
                x = CONFIG.EDGE_MARGIN;
                y = Math.floor(Math.random() * maxY);
                break;
            case 'right':
                x = maxX - CONFIG.EDGE_MARGIN;
                y = Math.floor(Math.random() * maxY);
                break;
            case 'top-right':
                x = maxX - CONFIG.EDGE_MARGIN - Math.floor(Math.random() * 100);
                y = CONFIG.EDGE_MARGIN + Math.floor(Math.random() * 100);
                break;
            case 'top-left':
                x = CONFIG.EDGE_MARGIN + Math.floor(Math.random() * 100);
                y = CONFIG.EDGE_MARGIN + Math.floor(Math.random() * 100);
                break;
            case 'bottom-right':
                x = maxX - CONFIG.EDGE_MARGIN - Math.floor(Math.random() * 100);
                y = maxY - CONFIG.EDGE_MARGIN - Math.floor(Math.random() * 100);
                break;
            case 'bottom-left':
                x = CONFIG.EDGE_MARGIN + Math.floor(Math.random() * 100);
                y = maxY - CONFIG.EDGE_MARGIN - Math.floor(Math.random() * 100);
                break;
            default:
                x = Math.floor(Math.random() * maxX);
                y = Math.floor(Math.random() * maxY);
        }
        
        return {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY))
        };
    },
    
    /**
     * 检测重叠
     * @param {Object} newPos - 新位置 { x, y }
     * @param {Object} wallRect - 照片墙尺寸
     * @returns {boolean} 是否重叠超标
     */
    checkOverlap: function(newPos, wallRect) {
        const cards = document.querySelectorAll('.photo-card');
        const newRect = {
            left: newPos.x,
            top: newPos.y,
            right: newPos.x + 280,
            bottom: newPos.y + 320,
            width: 280,
            height: 320
        };
        
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const rect = {
                left: parseInt(card.style.left),
                top: parseInt(card.style.top),
                right: parseInt(card.style.left) + 280,
                bottom: parseInt(card.style.top) + 320,
                width: 280,
                height: 320
            };
            
            const overlapRatio = UploadManager.calculateOverlapRatio(newRect, rect);
            if (overlapRatio > CONFIG.MAX_OVERLAP_RATIO) {
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * 计算重叠比例
     * @param {Object} rect1 - 矩形1
     * @param {Object} rect2 - 矩形2
     * @returns {number} 重叠比例（0-1）
     */
    calculateOverlapRatio: function(rect1, rect2) {
        const overlapX = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
        const overlapY = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
        const overlapArea = overlapX * overlapY;
        const minArea = Math.min(rect1.width * rect1.height, rect2.width * rect2.height);
        
        return minArea > 0 ? overlapArea / minArea : 0;
    },
    
    /**
     * 显示上传进度
     * @param {number} current - 当前数量
     * @param {number} total - 总数
     */
    showUploadProgress: function(current, total) {
        const toast = document.getElementById('toast');
        if (current < total) {
            toast.textContent = '正在上传 ' + current + '/' + total + ' 张照片...';
            toast.className = 'toast';
            toast.style.display = 'block';
        }
    },
    
    /**
     * 显示上传结果
     * @param {number} success - 成功数
     * @param {number} fail - 失败数
     * @param {number} total - 总数
     */
    showUploadResult: function(success, fail, total) {
        const toast = document.getElementById('toast');
        if (fail === 0) {
            toast.textContent = '成功上传 ' + success + ' 张照片';
            toast.className = 'toast success';
        } else {
            toast.textContent = '成功 ' + success + ' 张，失败 ' + fail + ' 张';
            toast.className = 'toast error';
        }
        toast.style.display = 'block';
        
        setTimeout(function() {
            toast.style.display = 'none';
        }, 3000);
    }
};

/* ============================================
   照片卡片管理模块 (PhotoCardManager) - 已更新
   ============================================ */

/**
 * 照片卡片管理模块 - 负责创建、更新、删除照片卡片
 */
const PhotoCardManager = {
    // 当前z-index计数器
    currentZIndex: 1,
    
    // 存储所有照片数据
    photos: [],
    
    /**
     * 创建照片卡片DOM元素
     * @param {Object} data - 照片数据
     * @returns {HTMLElement} 照片卡片元素
     */
    create: function(data) {
        // 创建卡片容器
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.dataset.id = data.id;
        
        // 设置z-index
        data.zIndex = data.zIndex || PhotoCardManager.getNextZIndex();
        
        // 应用样式
        card.style.left = data.positionX + 'px';
        card.style.top = data.positionY + 'px';
        card.style.transform = 'rotate(' + data.rotation + 'deg)';
        card.style.zIndex = data.zIndex;
        
        // 创建胶带装饰
        const tape = document.createElement('div');
        tape.className = 'photo-card-tape';
        card.appendChild(tape);
        
        // 创建图片区域
        const imgContainer = document.createElement('div');
        imgContainer.className = 'photo-card-image';
        
        const img = document.createElement('img');
        img.src = data.imageUrl;
        img.alt = data.caption || '照片';
        
        imgContainer.appendChild(img);
        card.appendChild(imgContainer);
        
        // 创建文字区域
        const caption = document.createElement('div');
        caption.className = 'photo-card-caption' + (data.caption !== '点击编辑文字' ? ' has-text' : '') + ' editable';
        caption.textContent = data.caption || '点击编辑文字';
        card.appendChild(caption);
        
        // 创建时间和地点信息（隐藏，编辑时显示）
        const info = document.createElement('div');
        info.className = 'photo-card-info';
        info.style.display = 'none';
        if (data.time) info.dataset.time = data.time;
        if (data.location) info.dataset.location = data.location;
        card.appendChild(info);
        
        // 绑定拖拽事件
        DragManager.init(card);
        
        // 绑定双击编辑事件
        caption.addEventListener('dblclick', function() {
            EditModal.open(card);
        });
        
        // 绑定右键删除事件
        card.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            ContextMenu.show(card, e.clientX, e.clientY);
        });
        
        // 绑定点击放大事件（点击图片区域）
        imgContainer.addEventListener('click', function(e) {
            e.stopPropagation();
            PhotoViewerManager.open(card);
        });
        
        // 存储数据
        PhotoCardManager.photos.push(data);
        
        return card;
    },
    
    /**
     * 更新卡片位置
     * @param {HTMLElement} card - 卡片元素
     * @param {number} x - 水平位置
     * @param {number} y - 垂直位置
     */
    updatePosition: function(card, x, y) {
        // 边界检测
        const photoWall = document.getElementById('photoWall');
        const wallRect = photoWall.getBoundingClientRect();
        
        x = Math.max(0, Math.min(x, wallRect.width - 280));
        y = Math.max(0, Math.min(y, wallRect.height - 320));
        
        card.style.left = x + 'px';
        card.style.top = y + 'px';
        
        // 更新数据
        const id = card.dataset.id;
        const photo = PhotoCardManager.photos.find(function(p) {
            return p.id === id;
        });
        if (photo) {
            photo.positionX = x;
            photo.positionY = y;
        }
    },
    
    /**
     * 更新卡片文字
     * @param {HTMLElement} card - 卡片元素
     * @param {string} caption - 文字内容
     */
    updateCaption: function(card, caption) {
        const captionEl = card.querySelector('.photo-card-caption');
        if (captionEl) {
            captionEl.textContent = caption || '点击编辑文字';
            captionEl.classList.toggle('has-text', caption !== '' && caption !== '点击编辑文字');
        }
        
        // 更新数据
        const id = card.dataset.id;
        const photo = PhotoCardManager.photos.find(function(p) {
            return p.id === id;
        });
        if (photo) {
            photo.caption = caption || '点击编辑文字';
        }
    },
    
    /**
     * 更新卡片时间
     * @param {HTMLElement} card - 卡片元素
     * @param {string} time - 时间
     */
    updateTime: function(card, time) {
        const id = card.dataset.id;
        const photo = PhotoCardManager.photos.find(function(p) {
            return p.id === id;
        });
        if (photo) {
            photo.time = time;
        }
    },
    
    /**
     * 更新卡片地点
     * @param {HTMLElement} card - 卡片元素
     * @param {string} location - 地点
     */
    updateLocation: function(card, location) {
        const id = card.dataset.id;
        const photo = PhotoCardManager.photos.find(function(p) {
            return p.id === id;
        });
        if (photo) {
            photo.location = location;
        }
    },
    
    /**
     * 更新卡片旋转角度
     * @param {HTMLElement} card - 卡片元素
     * @param {number} rotation - 旋转角度
     */
    updateRotation: function(card, rotation) {
        card.style.transform = 'rotate(' + rotation + 'deg)';
        
        // 更新数据
        const id = card.dataset.id;
        const photo = PhotoCardManager.photos.find(function(p) {
            return p.id === id;
        });
        if (photo) {
            photo.rotation = rotation;
        }
    },
    
    /**
     * 删除卡片
     * @param {HTMLElement} card - 卡片元素
     */
    delete: function(card) {
        const id = card.dataset.id;
        
        // 从数据中移除
        PhotoCardManager.photos = PhotoCardManager.photos.filter(function(p) {
            return p.id !== id;
        });
        
        // 从DOM中移除
        card.remove();
        
        // 保存到LocalStorage
        saveAllData();
        
        // 更新照片计数
        updatePhotoCount();
        
        showToast('照片已删除', 'success');
    },
    
    /**
     * 生成随机位置
     * @param {number} maxX - 最大水平位置
     * @param {number} maxY - 最大垂直位置
     * @returns {Object} { x: number, y: number }
     */
    generateRandomPosition: function(maxX, maxY) {
        return {
            x: Math.floor(Math.random() * Math.max(0, maxX)),
            y: Math.floor(Math.random() * Math.max(0, maxY))
        };
    },
    
    /**
     * 生成随机旋转角度
     * @returns {number} -15°至15°的随机角度
     */
    generateRandomRotation: function() {
        return Math.floor(Math.random() * 31) - 15;  // -15到15
    },
    
    /**
     * 获取下一个z-index
     * @returns {number} z-index值
     */
    getNextZIndex: function() {
        return PhotoCardManager.currentZIndex++;
    }
};

/* ============================================
   拖拽交互模块 (DragManager)
   ============================================ */

/**
 * 拖拽管理模块 - 处理卡片拖拽交互
 */
const DragManager = {
    // 拖拽状态
    isDragging: false,
    currentCard: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    
    /**
     * 初始化卡片拖拽
     * @param {HTMLElement} card - 卡片元素
     */
    init: function(card) {
        card.addEventListener('mousedown', function(e) {
            // 防止在点击图片时触发拖拽
            if (e.target.closest('.photo-card-image')) {
                return;
            }
            DragManager.onStart(card, e);
        });
        
        card.addEventListener('touchstart', function(e) {
            if (e.target.closest('.photo-card-image')) {
                return;
            }
            DragManager.onStart(card, e.touches[0]);
        });
    },
    
    /**
     * 开始拖拽
     * @param {HTMLElement} card - 卡片元素
     * @param {Object} e - 事件对象
     */
    onStart: function(card, e) {
        // 防止在编辑状态下触发拖拽
        if (e.target.classList.contains('photo-card-caption') && e.detail === 2) {
            return;
        }
        
        DragManager.isDragging = true;
        DragManager.currentCard = card;
        
        DragManager.startX = e.clientX;
        DragManager.startY = e.clientY;
        
        const rect = card.getBoundingClientRect();
        const photoWall = document.getElementById('photoWall').getBoundingClientRect();
        
        DragManager.initialX = rect.left - photoWall.left;
        DragManager.initialY = rect.top - photoWall.top;
        
        // 提升z-index到最上层
        card.style.zIndex = PhotoCardManager.getNextZIndex();
        
        // 绑定移动和释放事件
        document.addEventListener('mousemove', DragManager.onMove);
        document.addEventListener('mouseup', DragManager.onEnd);
        document.addEventListener('touchmove', DragManager.onMoveTouch);
        document.addEventListener('touchend', DragManager.onEnd);
        
        e.preventDefault();
    },
    
    /**
     * 拖拽移动
     * @param {Object} e - 事件对象
     */
    onMove: function(e) {
        if (!DragManager.isDragging) return;
        
        const dx = e.clientX - DragManager.startX;
        const dy = e.clientY - DragManager.startY;
        
        const newX = DragManager.initialX + dx;
        const newY = DragManager.initialY + dy;
        
        DragManager.updateCardPosition(newX, newY);
    },
    
    /**
     * 触摸移动
     * @param {Object} e - 事件对象
     */
    onMoveTouch: function(e) {
        if (!DragManager.isDragging) return;
        
        const touch = e.touches[0];
        const dx = touch.clientX - DragManager.startX;
        const dy = touch.clientY - DragManager.startY;
        
        const newX = DragManager.initialX + dx;
        const newY = DragManager.initialY + dy;
        
        DragManager.updateCardPosition(newX, newY);
        e.preventDefault();
    },
    
    /**
     * 更新卡片位置
     * @param {number} x - 水平位置
     * @param {number} y - 垂直位置
     */
    updateCardPosition: function(x, y) {
        const card = DragManager.currentCard;
        if (!card) return;
        
        // 边界检测
        const photoWall = document.getElementById('photoWall');
        const wallRect = photoWall.getBoundingClientRect();
        
        x = Math.max(0, Math.min(x, wallRect.width - 280));
        y = Math.max(0, Math.min(y, wallRect.height - 320));
        
        card.style.left = x + 'px';
        card.style.top = y + 'px';
    },
    
    /**
     * 结束拖拽
     */
    onEnd: function() {
        if (!DragManager.isDragging) return;
        
        DragManager.isDragging = false;
        
        // 保存最终位置
        if (DragManager.currentCard) {
            const id = DragManager.currentCard.dataset.id;
            const photo = PhotoCardManager.photos.find(function(p) {
                return p.id === id;
            });
            if (photo) {
                photo.positionX = parseInt(DragManager.currentCard.style.left);
                photo.positionY = parseInt(DragManager.currentCard.style.top);
                
                // 保存到LocalStorage
                saveAllData();
            }
        }
        
        DragManager.currentCard = null;
        
        // 移除事件监听
        document.removeEventListener('mousemove', DragManager.onMove);
        document.removeEventListener('mouseup', DragManager.onEnd);
        document.removeEventListener('touchmove', DragManager.onMoveTouch);
        document.removeEventListener('touchend', DragManager.onEnd);
    }
};

/* ============================================
   编辑弹窗模块 (EditModal)
   ============================================ */

/**
 * 编辑弹窗模块 - 处理文字编辑弹窗
 */
const EditModal = {
    currentCard: null,
    modal: null,
    input: null,
    
    /**
     * 打开编辑弹窗
     * @param {HTMLElement} card - 卡片元素
     */
    open: function(card) {
        EditModal.currentCard = card;
        EditModal.modal = document.getElementById('editModal');
        EditModal.input = document.getElementById('captionInput');
        
        // 填充当前文字
        const caption = card.querySelector('.photo-card-caption').textContent;
        EditModal.input.value = caption === '点击编辑文字' ? '' : caption;
        
        // 更新字符计数
        EditModal.updateCharCount();
        
        // 显示弹窗
        EditModal.modal.style.display = 'flex';
        
        // 聚焦输入框
        setTimeout(function() {
            EditModal.input.focus();
        }, 100);
    },
    
    /**
     * 关闭编辑弹窗
     */
    close: function() {
        if (EditModal.modal) {
            EditModal.modal.style.display = 'none';
        }
        EditModal.currentCard = null;
    },
    
    /**
     * 更新字符计数
     */
    updateCharCount: function() {
        const charCount = document.getElementById('charCount');
        const length = EditModal.input.value.length;
        charCount.textContent = length + '/' + CONFIG.MAX_CAPTION_LENGTH;
    },
    
    /**
     * 确认编辑
     */
    confirm: function() {
        if (!EditModal.currentCard) return;
        
        const caption = EditModal.input.value.trim();
        
        // 校验文字长度
        if (caption.length > CONFIG.MAX_CAPTION_LENGTH) {
            showToast('文字长度不能超过' + CONFIG.MAX_CAPTION_LENGTH + '个字符', 'error');
            return;
        }
        
        // 更新卡片文字
        PhotoCardManager.updateCaption(EditModal.currentCard, caption);
        
        // 保存到LocalStorage
        saveAllData();
        
        showToast('文字已保存', 'success');
        
        EditModal.close();
    }
};

/* ============================================
   右键菜单模块 (ContextMenu)
   ============================================ */

/**
 * 右键菜单模块 - 处理右键删除菜单
 */
const ContextMenu = {
    currentCard: null,
    menu: null,
    
    /**
     * 显示右键菜单
     * @param {HTMLElement} card - 卡片元素
     * @param {number} x - 水平位置
     * @param {number} y - 垂直位置
     */
    show: function(card, x, y) {
        ContextMenu.currentCard = card;
        ContextMenu.menu = document.getElementById('contextMenu');
        
        ContextMenu.menu.style.display = 'block';
        ContextMenu.menu.style.left = x + 'px';
        ContextMenu.menu.style.top = y + 'px';
    },
    
    /**
     * 隐藏右键菜单
     */
    hide: function() {
        if (ContextMenu.menu) {
            ContextMenu.menu.style.display = 'none';
        }
        ContextMenu.currentCard = null;
    },
    
    /**
     * 删除当前卡片
     */
    deleteCurrent: function() {
        if (ContextMenu.currentCard) {
            PhotoCardManager.delete(ContextMenu.currentCard);
        }
        ContextMenu.hide();
    }
};

/* ============================================
   背景缩放模块 (BackgroundScaleManager) - 新增
   ============================================ */

/**
 * 背景缩放管理模块 - 处理鼠标滚轮缩放背景功能
 */
const BackgroundScaleManager = {
    currentScale: 1.0,
    
    /**
     * 初始化背景缩放模块
     */
    init: function() {
        // 从LocalStorage读取缩放比例
        const data = DataManager.load();
        if (data.background && data.background.backgroundScale) {
            BackgroundScaleManager.currentScale = data.background.backgroundScale;
        }
        
        // 应用初始缩放
        BackgroundScaleManager.applyScale(BackgroundScaleManager.currentScale);
        
        // 绑定滚轮事件
        const photoWall = document.getElementById('photoWall');
        photoWall.addEventListener('wheel', function(e) {
            BackgroundScaleManager.handleWheel(e);
        });
        
        // 添加缩放指示器
        BackgroundScaleManager.addScaleIndicator();
    },
    
    /**
     * 处理滚轮事件
     * @param {WheelEvent} e - 滚轮事件
     */
    handleWheel: function(e) {
        e.preventDefault();
        
        // 计算缩放方向
        const delta = e.deltaY < 0 ? 1 : -1;
        const newScale = BackgroundScaleManager.currentScale + (delta * CONFIG.SCALE_STEP);
        
        // 限制缩放范围
        const clampedScale = Math.max(CONFIG.MIN_SCALE, Math.min(CONFIG.MAX_SCALE, newScale));
        
        // 获取鼠标位置作为缩放中心
        const rect = e.currentTarget.getBoundingClientRect();
        const originX = e.clientX - rect.left;
        const originY = e.clientY - rect.top;
        
        // 应用缩放
        BackgroundScaleManager.applyScale(clampedScale, originX, originY);
    },
    
    /**
     * 应用缩放
     * @param {number} scale - 缩放比例
     * @param {number} originX - 缩放中心X
     * @param {number} originY - 缩放中心Y
     */
    applyScale: function(scale, originX, originY) {
        BackgroundScaleManager.currentScale = scale;
        
        const photoWall = document.getElementById('photoWall');
        
        // 设置缩放中心
        if (originX !== undefined && originY !== undefined) {
            photoWall.style.transformOrigin = originX + 'px ' + originY + 'px';
        }
        
        // 应用缩放
        photoWall.style.transform = 'scale(' + scale + ')';
        
        // 更新缩放指示器
        BackgroundScaleManager.updateScaleIndicator(scale);
        
        // 保存到LocalStorage
        saveAllData();
    },
    /**
     * 设置缩放比例
     * @param {number} scale - 缩放比例
     */
    setScale: function(scale) {
        const clampedScale = Math.max(CONFIG.MIN_SCALE, Math.min(CONFIG.MAX_SCALE, scale));
        BackgroundScaleManager.applyScale(clampedScale);
    },
    
    /**
     * 获取当前缩放比例
     * @returns {number} 缩放比例
     */
    getScale: function() {
        return BackgroundScaleManager.currentScale;
    },
    
    /**
     * 重置缩放
     */
    resetScale: function() {
        BackgroundScaleManager.applyScale(1.0);
    },
    
    /**
     * 添加缩放指示器
     */
    addScaleIndicator: function() {
        const indicator = document.createElement('div');
        indicator.className = 'scale-indicator';
        indicator.id = 'scaleIndicator';
        indicator.textContent = Math.round(BackgroundScaleManager.currentScale * 100) + '%';
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .scale-indicator {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: rgba(0, 0, 0, 0.7);
                color: #fff;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 1000;
                pointer-events: none;
            }
            .photo-wall {
                transition: transform 0.2s ease-out;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(indicator);
    },
    
    /**
     * 更新缩放指示器
     * @param {number} scale - 缩放比例
     */
    updateScaleIndicator: function(scale) {
        const indicator = document.getElementById('scaleIndicator');
        if (indicator) {
            indicator.textContent = Math.round(scale * 100) + '%';
        }
    }
};

/* ============================================
   视图切换模块 (ViewModeManager) - 新增
   ============================================ */

/**
 * 视图切换管理模块 - 处理照片墙模式和书架模式的切换
 */
const ViewModeManager = {
    currentMode: 'photo_wall',
    
    /**
     * 初始化视图切换模块
     */
    init: function() {
        // 从LocalStorage读取视图模式
        const data = DataManager.load();
        if (data.viewMode) {
            ViewModeManager.currentMode = data.viewMode;
        }
        
        // 绑定视图标签点击事件
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                const mode = tab.dataset.mode;
                if (mode === 'shelf') {
                    ViewModeManager.switchToShelf();
                } else if (mode === 'photo_wall') {
                    ViewModeManager.switchToPhotoWall();
                }
            });
        });
        
        // 应用上次视图模式
        if (ViewModeManager.currentMode === 'shelf') {
            ViewModeManager.switchToShelf(true);
        } else {
            ViewModeManager.switchToPhotoWall(true);
        }
    },
    
    /**
     * 切换到书架模式
     * @param {boolean} silent - 是否静默（不保存状态）
     */
    switchToShelf: function(silent) {
        ViewModeManager.currentMode = 'shelf';
        
        // 保存当前位置
        ViewModeManager.saveCurrentPositions();
        
        // 按时间排序
        const sortedPhotos = ViewModeManager.sortByTime(PhotoCardManager.photos);
        
        // 计算网格布局位置
        const photoWall = document.getElementById('photoWall');
        const wallRect = photoWall.getBoundingClientRect();
        
        // 添加书架模式样式
        photoWall.classList.add('shelf-mode');
        
        // 更新每张照片位置
        sortedPhotos.forEach(function(photo, index) {
            const pos = ViewModeManager.calculateGridPosition(index, wallRect.width);
            const card = document.querySelector('[data-id="' + photo.id + '"]');
            if (card) {
                card.style.left = pos.x + 'px';
                card.style.top = pos.y + 'px';
                card.style.transform = 'rotate(0deg)';
                card.style.zIndex = index + 1;
            }
        });
        
        // 更新视图标签状态
        ViewModeManager.updateTabState('shelf');
        
        // 保存到LocalStorage
        if (!silent) {
            saveAllData();
            showToast('已切换到书架模式', 'success');
        }
    },
    
    /**
     * 切换到照片墙模式
     * @param {boolean} silent - 是否静默（不保存状态）
     */
    switchToPhotoWall: function(silent) {
        ViewModeManager.currentMode = 'photo_wall';
        
        // 移除书架模式样式
        const photoWall = document.getElementById('photoWall');
        photoWall.classList.remove('shelf-mode');
        
        // 恢复原始位置
        ViewModeManager.restoreOriginalPositions();
        
        // 更新视图标签状态
        ViewModeManager.updateTabState('photo_wall');
        
        // 保存到LocalStorage
        if (!silent) {
            saveAllData();
            showToast('已切换到照片墙模式', 'success');
        }
    },
    
    /**
     * 保存当前位置
     */
    saveCurrentPositions: function() {
        PhotoCardManager.photos.forEach(function(photo) {
            const card = document.querySelector('[data-id="' + photo.id + '"]');
            if (card) {
                photo.originalPositionX = parseInt(card.style.left);
                photo.originalPositionY = parseInt(card.style.top);
                photo.originalRotation = photo.rotation;
            }
        });
    },
    
    /**
     * 恢复原始位置
     */
    restoreOriginalPositions: function() {
        PhotoCardManager.photos.forEach(function(photo) {
            const card = document.querySelector('[data-id="' + photo.id + '"]');
            if (card) {
                card.style.left = photo.originalPositionX + 'px';
                card.style.top = photo.originalPositionY + 'px';
                card.style.transform = 'rotate(' + photo.originalRotation + 'deg)';
                card.style.zIndex = photo.zIndex;
            }
        });
    },
    
    /**
     * 按时间排序
     * @param {Array} photos - 照片数组
     * @returns {Array} 排序后的照片数组
     */
    sortByTime: function(photos) {
        return photos.slice().sort(function(a, b) {
            // 有时间的排在前面
            if (a.time && b.time) {
                return a.time.localeCompare(b.time);
            }
            if (a.time) return -1;
            if (b.time) return 1;
            // 都没有时间按创建时间排序
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
    },
    
    /**
     * 计算网格布局位置
     * @param {number} index - 索引
     * @param {number} wallWidth - 照片墙宽度
     * @returns {Object} { x, y }
     */
    calculateGridPosition: function(index, wallWidth) {
        const col = index % CONFIG.SHELF_COLUMNS;
        const row = Math.floor(index / CONFIG.SHELF_COLUMNS);
        
        const x = col * (280 + CONFIG.SHELF_GAP) + 20;
        const y = row * (320 + CONFIG.SHELF_GAP) + 20;
        
        return { x: x, y: y };
    },
    
    /**
     * 更新视图标签状态
     * @param {string} activeMode - 当前激活的模式
     */
    updateTabState: function(activeMode) {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(function(tab) {
            if (tab.dataset.mode === activeMode) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
};

/* ============================================
   照片查看器模块 (PhotoViewerManager) - 新增
   ============================================ */

/**
 * 照片查看器管理模块 - 处理照片放大显示
 */
const PhotoViewerManager = {
    currentIndex: -1,
    currentPhoto: null,
    
    /**
     * 初始化照片查看器
     */
    init: function() {
        // 创建查看器DOM结构
        const viewer = document.createElement('div');
        viewer.id = 'photoViewer';
        viewer.className = 'photo-viewer';
        viewer.style.display = 'none';
        viewer.innerHTML = `
            <div class="viewer-overlay"></div>
            <div class="viewer-content">
                <button class="viewer-close">&times;</button>
                <button class="viewer-prev">&#10094;</button>
                <button class="viewer-next">&#10095;</button>
                <img class="viewer-image" src="" alt="">
            </div>
        `;
        document.body.appendChild(viewer);
        
        // 绑定事件
        viewer.querySelector('.viewer-close').addEventListener('click', function() {
            PhotoViewerManager.close();
        });
        viewer.querySelector('.viewer-overlay').addEventListener('click', function() {
            PhotoViewerManager.close();
        });
        viewer.querySelector('.viewer-prev').addEventListener('click', function() {
            PhotoViewerManager.showPrev();
        });
        viewer.querySelector('.viewer-next').addEventListener('click', function() {
            PhotoViewerManager.showNext();
        });
        
        // 键盘事件
        document.addEventListener('keydown', function(e) {
            if (PhotoViewerManager.currentPhoto) {
                if (e.key === 'Escape') {
                    PhotoViewerManager.close();
                } else if (e.key === 'ArrowLeft') {
                    PhotoViewerManager.showPrev();
                } else if (e.key === 'ArrowRight') {
                    PhotoViewerManager.showNext();
                }
            }
        });
    },
    
    /**
     * 打开查看器
     * @param {HTMLElement} cardEl - 卡片元素
     */
    open: function(cardEl) {
        const id = cardEl.dataset.id;
        const photo = PhotoCardManager.photos.find(function(p) {
            return p.id === id;
        });
        
        if (!photo) return;
        
        PhotoViewerManager.currentPhoto = photo;
        PhotoViewerManager.currentIndex = PhotoCardManager.photos.indexOf(photo);
        
        const viewer = document.getElementById('photoViewer');
        const img = viewer.querySelector('.viewer-image');
        
        img.src = photo.imageUrl;
        img.alt = photo.caption || '照片';
        
        viewer.style.display = 'block';
        
        // 打开编辑选项卡
        EditTabManager.open(cardEl);
    },
    
    /**
     * 关闭查看器
     */
    close: function() {
        const viewer = document.getElementById('photoViewer');
        viewer.style.display = 'none';
        PhotoViewerManager.currentPhoto = null;
        PhotoViewerManager.currentIndex = -1;
        
        // 关闭编辑选项卡
        EditTabManager.close();
    },
    
    /**
     * 显示上一张
     */
    showPrev: function() {
        if (PhotoViewerManager.currentIndex <= 0) return;
        
        PhotoViewerManager.currentIndex--;
        const photo = PhotoCardManager.photos[PhotoViewerManager.currentIndex];
        const card = document.querySelector('[data-id="' + photo.id + '"]');
        
        if (card) {
            PhotoViewerManager.open(card);
        }
    },
    
    /**
     * 显示下一张
     */
    showNext: function() {
        if (PhotoViewerManager.currentIndex >= PhotoCardManager.photos.length - 1) return;
        
        PhotoViewerManager.currentIndex++;
        const photo = PhotoCardManager.photos[PhotoViewerManager.currentIndex];
        const card = document.querySelector('[data-id="' + photo.id + '"]');
        
        if (card) {
            PhotoViewerManager.open(card);
        }
    }
};

/* ============================================
   编辑选项卡模块 (EditTabManager) - 新增
   ============================================ */

/**
 * 编辑选项卡管理模块 - 处理照片信息编辑
 */
const EditTabManager = {
    currentPhotoId: null,
    
    /**
     * 初始化编辑选项卡
     */
    init: function() {
        // 创建选项卡DOM结构
        const tab = document.createElement('div');
        tab.id = 'editTab';
        tab.className = 'edit-tab';
        tab.innerHTML = `
            <div class="edit-tab-header">
                <h3>照片信息</h3>
                <button class="edit-tab-close">&times;</button>
            </div>
            <div class="edit-tab-body">
                <div class="form-group">
                    <label for="editTime">时间</label>
                    <input type="date" id="editTime" class="edit-time">
                </div>
                <div class="form-group">
                    <label for="editLocation">地点</label>
                    <input type="text" id="editLocation" class="edit-location" placeholder="请输入拍摄地点" maxlength="${CONFIG.MAX_LOCATION_LENGTH}">
                </div>
                <div class="form-buttons">
                    <button id="btnSaveInfo" class="btn btn-primary">保存</button>
                    <button id="btnDeletePhoto" class="btn btn-secondary btn-delete">删除照片</button>
                </div>
            </div>
        `;
        document.body.appendChild(tab);
        
        // 绑定事件
        tab.querySelector('.edit-tab-close').addEventListener('click', function() {
            EditTabManager.close();
        });
        
        document.getElementById('btnSaveInfo').addEventListener('click', function() {
            EditTabManager.saveInfo();
        });
        
        document.getElementById('btnDeletePhoto').addEventListener('click', function() {
            EditTabManager.deletePhoto();
        });
    },
    
    /**
     * 打开选项卡
     * @param {HTMLElement} cardEl - 卡片元素
     */
    open: function(cardEl) {
        const id = cardEl.dataset.id;
        const photo = PhotoCardManager.photos.find(function(p) {
            return p.id === id;
        });
        
        if (!photo) return;
        
        EditTabManager.currentPhotoId = id;
        
        const tab = document.getElementById('editTab');
        const timeInput = document.getElementById('editTime');
        const locationInput = document.getElementById('editLocation');
        
        // 填充表单
        timeInput.value = photo.time || '';
        locationInput.value = photo.location || '';
        
        // 显示选项卡
        tab.style.transform = 'translateX(0)';
    },
    
    /**
     * 关闭选项卡
     */
    close: function() {
        const tab = document.getElementById('editTab');
        tab.style.transform = 'translateX(100%)';
        EditTabManager.currentPhotoId = null;
    },
    
    /**
     * 保存信息
     */
    saveInfo: function() {
        if (!EditTabManager.currentPhotoId) return;
        
        const time = document.getElementById('editTime').value;
        const location = document.getElementById('editLocation').value.trim();
        
        // 校验地点长度
        if (location.length > CONFIG.MAX_LOCATION_LENGTH) {
            showToast('地点长度不能超过' + CONFIG.MAX_LOCATION_LENGTH + '个字符', 'error');
            return;
        }
        
        // 更新数据
        const photo = PhotoCardManager.photos.find(function(p) {
            return p.id === EditTabManager.currentPhotoId;
        });
        
        if (photo) {
            photo.time = time;
            photo.location = location;
            
            // 保存到LocalStorage
            saveAllData();
            showToast('信息已保存', 'success');
        }
    },
    
    /**
     * 删除照片
     */
    deletePhoto: function() {
        if (!EditTabManager.currentPhotoId) return;
        
        // 二次确认
        if (!confirm('确定要删除这张照片吗？')) {
            return;
        }
        
        const card = document.querySelector('[data-id="' + EditTabManager.currentPhotoId + '"]');
        if (card) {
            PhotoCardManager.delete(card);
        }
        
        EditTabManager.close();
        PhotoViewerManager.close();
    }
};

/* ============================================
   背景设置模块 (BackgroundManager)
   ============================================ */

/**
 * 背景管理模块 - 处理背景颜色设置
 */
const BackgroundManager = {
    currentColor: CONFIG.DEFAULT_BACKGROUND,
    
    /**
     * 初始化背景设置模块
     */
    init: function() {
        // 从LocalStorage读取背景设置
        const data = DataManager.load();
        BackgroundManager.currentColor = data.background.backgroundColor;
        
        // 应用背景颜色
        BackgroundManager.setColor(BackgroundManager.currentColor);
        
        // 绑定"更换墙面背景"按钮事件
        const changeBgBtn = document.getElementById('changeBgBtn');
        const colorPicker = document.getElementById('colorPicker');
        
        changeBgBtn.addEventListener('click', function() {
            colorPicker.style.display = colorPicker.style.display === 'none' ? 'flex' : 'none';
        });
        
        // 绑定"恢复默认墙面"按钮事件
        const resetBgBtn = document.getElementById('resetBgBtn');
        resetBgBtn.addEventListener('click', function() {
            BackgroundManager.resetToDefault();
        });
        
        // 生成颜色选择器
        BackgroundManager.renderColorPicker();
    },
    
    /**
     * 渲染颜色选择器
     */
    renderColorPicker: function() {
        const colorPicker = document.getElementById('colorPicker');
        colorPicker.innerHTML = '';
        
        CONFIG.PRESET_COLORS.forEach(function(color) {
            const colorOption = document.createElement('div');
            colorOption.className = 'color-option';
            colorOption.style.backgroundColor = color;
            
            if (color === BackgroundManager.currentColor) {
                colorOption.classList.add('selected');
            }
            
            colorOption.addEventListener('click', function() {
                BackgroundManager.setColor(color);
            });
            
            colorPicker.appendChild(colorOption);
        });
    },
    
    /**
     * 设置背景颜色
     * @param {string} color - 背景颜色
     */
    setColor: function(color) {
        BackgroundManager.currentColor = color;
        
        // 更新照片墙背景
        const photoWall = document.getElementById('photoWall');
        photoWall.style.backgroundColor = color;
        
        // 更新颜色选择器选中状态
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(function(option) {
            option.classList.toggle('selected', option.style.backgroundColor === color);
        });
        
        // 保存到LocalStorage
        saveAllData();
        
        showToast('背景颜色已更新', 'success');
    },
    
    /**
     * 恢复默认背景
     */
    resetToDefault: function() {
        BackgroundManager.setColor(CONFIG.DEFAULT_BACKGROUND);
    }
};

/* ============================================
   功能区模块 (FunctionAreaManager) - 新增
   ============================================ */

/**
 * 功能区管理模块 - 处理功能区按钮事件
 */
const FunctionAreaManager = {
    /**
     * 初始化功能区模块
     */
    init: function() {
        // 绑定"返回首页"按钮事件
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.addEventListener('click', function() {
                window.location.href = 'index.html';
            });
        }
    }
};

/* ============================================
   辅助函数
   ============================================ */

/**
 * 显示Toast提示
 * @param {string} message - 提示信息
 * @param {string} type - 提示类型 (success/error)
 */
function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(function() {
        toast.style.display = 'none';
    }, 3000);
}

/**
 * 更新照片计数
 */
function updatePhotoCount() {
    const photoCount = document.getElementById('photoCount');
    const count = PhotoCardManager.photos.length;
    photoCount.textContent = '已贴 ' + count + ' 张照片';
}

/**
 * 保存所有数据到LocalStorage
 */
function saveAllData() {
    const background = { 
        backgroundColor: BackgroundManager.currentColor,
        backgroundScale: BackgroundScaleManager.currentScale
    };
    DataManager.save(PhotoCardManager.photos, background);
}

/* ============================================
   页面初始化入口
   ============================================ */

/**
 * 页面加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', function() {
    // 1. 加载数据
    const data = DataManager.load();
    
    // 2. 初始化背景
    BackgroundManager.init();
    
    // 3. 初始化背景缩放
    BackgroundScaleManager.init();
    
    // 4. 渲染照片卡片
    const photoWall = document.getElementById('photoWall');
    data.photos.forEach(function(photoData) {
        const card = PhotoCardManager.create(photoData);
        photoWall.appendChild(card);
    });
    
    // 5. 初始化上传模块
    UploadManager.init();
    
    // 6. 初始化视图切换
    ViewModeManager.init();
    
    // 7. 初始化照片查看器
    PhotoViewerManager.init();
    
    // 8. 初始化编辑选项卡
    EditTabManager.init();
    
    // 9. 初始化功能区
    FunctionAreaManager.init();
    
    // 10. 更新照片计数
    updatePhotoCount();
    
    // 11. 绑定右键菜单事件
    const closeModal = document.getElementById('closeModal');
    const cancelEdit = document.getElementById('cancelEdit');
    const confirmEdit = document.getElementById('confirmEdit');
    const captionInput = document.getElementById('captionInput');
    
    closeModal.addEventListener('click', EditModal.close);
    cancelEdit.addEventListener('click', EditModal.close);
    confirmEdit.addEventListener('click', EditModal.confirm);
    
    captionInput.addEventListener('input', function() {
        EditModal.updateCharCount();
    });
    
    captionInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            EditModal.confirm();
        }
        if (e.key === 'Escape') {
            EditModal.close();
        }
    });
    
    // 12. 绑定右键菜单事件
    const deleteOption = document.getElementById('deleteOption');
    deleteOption.addEventListener('click', function() {
        ContextMenu.deleteCurrent();
    });
    
    // 14. 点击页面其他地方隐藏右键菜单
    document.addEventListener('click', function() {
        ContextMenu.hide();
    });
});
