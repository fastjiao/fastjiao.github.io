/**
 * 图片管理模块 - 基于 IndexedDB 实现持久化存储
 * 用于 admin.html 和 index.html 共享，实现图片替换的永久保留
 */

// IndexedDB 数据库名称与配置
const PHOTO_DB_NAME = 'lovejiao_photo_db';   // 数据库名
const PHOTO_STORE_NAME = 'photos';           // 存储仓库名
const PHOTO_DB_VERSION = 1;                  // 数据库版本

/**
 * 打开 IndexedDB 数据库
 * @returns {Promise<IDBDatabase>} 数据库实例
 */
function openPhotoDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
        // 首次创建或版本升级时，创建对象存储仓库
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
                db.createObjectStore(PHOTO_STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

/**
 * 保存图片到 IndexedDB（持久化存储）
 * @param {string} id - 图片标识，如 'photo-0'
 * @param {Blob} blob - 图片二进制数据
 * @param {string} fileName - 原始文件名
 */
async function savePhoto(id, blob, fileName) {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PHOTO_STORE_NAME);
        // 存储记录：id + 图片数据 + 文件名 + 保存时间
        store.put({ id, blob, fileName, savedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * 从 IndexedDB 读取指定图片
 * @param {string} id - 图片标识
 * @returns {Promise<{blob:Blob, fileName:string, savedAt:number}|null>}
 */
async function getPhoto(id) {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_STORE_NAME, 'readonly');
        const store = tx.objectStore(PHOTO_STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 删除指定图片记录（恢复为默认图片）
 * @param {string} id - 图片标识
 */
async function deletePhoto(id) {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PHOTO_STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}