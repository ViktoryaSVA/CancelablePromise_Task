const promiseResolveFunc = (cancelablePromise, value) => {
    cancelablePromise.status = 'fulfilled';
    cancelablePromise.value = value;
    cancelablePromise.onResolveCallbacks.forEach(callback => callback());
    cancelablePromise.finallyHandler();
};

const promiseRejectFunc = (cancelablePromise, reason) => {
    cancelablePromise.status = 'rejected';
    cancelablePromise.reason = reason;
    cancelablePromise.onRejectCallbacks.forEach(callback => callback());
    cancelablePromise.finallyHandler();
};

class CancelablePromise {
    constructor(executor) {
        if (typeof executor !== 'function') {
            throw new Error('CancelablePromise constructor requires a function argument');
        }

        this.status = 'pending';
        this.value = undefined;
        this.reason = undefined;
        this.isCanceled = false;
        this.onResolveCallbacks = [];
        this.onRejectCallbacks = [];
        this.promisesList = [];
        this.finallyHandler = () => {};

        const resolve = (value) => {
            if (this.status === 'pending') {
                return promiseResolveFunc(this, value);
            }
        };
        const reject = (reason) => {
            if (this.status === 'pending') {
                return promiseRejectFunc(this, reason);
            }
        }

        try {
            executor(resolve, reject);
        } catch (error) {
            reject(error);
        }
    }
    then(onFulfilled, onRejected) {
        if (onFulfilled && typeof onFulfilled !== 'function') {
            throw new Error('Cancelable promise fulfilled handler is not a function');
        }
        if (onRejected && typeof onRejected !== 'function') {
            throw new Error('Cancelable promise rejected handler is not a function');
        }
        const newPromise = new CancelablePromise((resolve, reject) => {
            const handleCallback = (callback, value, resolve, reject) => {
                try {
                    const result = callback(value);
                    if (result instanceof CancelablePromise || result instanceof Promise) {
                        result.then(resolve, reject);
                    } else {
                        resolve(result);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            const onResolve = () => {
                if (!this.isCanceled) {
                    if (typeof onFulfilled === 'function') {
                        handleCallback(onFulfilled, this.value, resolve, reject);
                    } else {
                        resolve(this.value);
                    }
                }
                this.finallyHandler();
            };

            const onReject = () => {
                if (typeof onRejected === 'function') {
                    handleCallback(onRejected, this.reason, resolve, reject);
                } else {
                    reject(this.reason);
                }
            };

            if (this.status === 'fulfilled') {
                onResolve();
            } else if (this.status === 'rejected') {
                onReject();
            } else {
                this.onResolveCallbacks.push(onResolve);
                this.onRejectCallbacks.push(onReject);
            }
        });

        this.promisesList.push(newPromise);
        newPromise.promisesList.push(this);
        return newPromise;
    }

    catch(onRejected) {
        return this.then(null, onRejected);
    }

    cancel() {
        this.isCanceled = true;
        promiseRejectFunc(this, { isCanceled: true });
        this.promisesList.forEach((chainedPromise) => {
            if (!chainedPromise.isCanceled)
                chainedPromise.cancel();
        });
    }

    static resolve(value) {
        return new CancelablePromise(resolve => resolve(value));
    }

    static reject(reason) {
        return new CancelablePromise((resolve, reject) => reject(reason));
    }
}

module.exports = CancelablePromise;