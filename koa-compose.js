'use strict'
// koa-compose模块可以将多个中间件函数合并成一个大的中间件函数
// 然后调用这个中间件函数就可以依次执行添加的中间件函数，执行一系列的任务。
/**
 * Expose compositor.
 */

module.exports = compose

/**
 * Compose `middleware` returning
 * a fully valid middleware comprised
 * of all those which are passed.
 *
 * @param {Array} middleware
 * @return {Function}
 * @api public
 */
// compose函数需要传入一个数组队列 [fn,fn,fn,fn]
function compose (middleware) {
  // 如果传入的不是数组，则抛出错误
  if (!Array.isArray(middleware)) throw new TypeError('Middleware stack must be an array!')
  // 数组队列中有一项不为函数，则抛出错误
  for (const fn of middleware) {
    if (typeof fn !== 'function') throw new TypeError('Middleware must be composed of functions!')
  }

  /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */
  // compose函数调用后，返回的是以下这个匿名函数
  // 匿名函数接收两个参数，第一个随便传入，根据使用场景决定
  // 第一次调用时候第二个参数next实际上是一个undefined，因为初次调用并不需要传入next参数
  // 这个匿名函数返回一个promise
  return function (context, next) {
    // last called middleware #
    let index = -1 // 初始下标为-1
    return dispatch(0)
    function dispatch (i) {
      // 如果传入i为负数且<=-1 返回一个Promise.reject携带着错误信息
      // 所以执行两次next会报出这个错误。将状态rejected，就是确保在一个中间件中next只调用一次
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i  // 执行一遍next之后,这个index值将改变
      let fn = middleware[i] // 根据下标取出一个中间件函数
      // next在这个内部中是一个局部变量，值为undefined
      // 当i已经是数组的length了，说明中间件函数都执行结束，执行结束后把fn设置为undefined
      // 问题：本来middleware[i]如果i为length的话取到的值已经是undefined了，为什么要重新给fn设置为undefined呢？
      if (i === middleware.length) fn = next // 这两行就是来处理最后一个中间件还有next的情况的，其实是可以直接resolve出来的 如: if (i === middleware.length) return Promise.resolve()
      //如果中间件遍历到最后了。那么。此时return Promise.resolve()返回一个成功状态的promise方便之后做调用then
      if (!fn) return Promise.resolve()
      try {
        return Promise.resolve(fn(context, function next () {
          return dispatch(i + 1)
        }))
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}

// ===========================================================================================================
// 其实这部分要跟koa源码中 application.js中的callback 结合起来看

/**
   * Return a request handler callback
   * for node's native http server.
   *
   * @return {Function}
   * @api public
   */

  /*
  callback() {
    const fn = compose(this.middleware);

    if (!this.listeners('error').length) this.on('error', this.onerror);

    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);
      return this.handleRequest(ctx, fn);
    };

    return handleRequest;
  }
  而callback的作用就是:
  listen(...args) {
    debug('listen');
    const server = http.createServer(this.callback());
    return server.listen(...args);
  }
  这里开始讲重点，koa-compose从语义上看就是组合，其实就是对koa中间件的组合,它返回了一个promise
  执行完成后就执行koa2对res的特殊处理，最后res.end()
  */


  /*
  当然我们关心的是如何对中间件组合，其实就是传入一个middleware数组
  然后第一次取出数组的第一个元素，传入context和next代码，执行当前这个元素（这个中间件）
  这里就是传入next执行中间件代码了

  return Promise.resolve(fn(context, function next () {
      return dispatch(i + 1)
  }))
  // 其实后面根本没用到resolve的内容，这部分代码等价于

  fn(context, function next () {
      return dispatch(i + 1)
  })
  return Promise.resolve()
  核心就在于dispatch(i + 1)，不过也很好理解，就是将数组指针移向下一个，执行下一个中间件的代码
  然后一直这样到最后一个中间件，假如最后一个中间件还有next那么下面这两段代码就起作用了
  if (i === middleware.length) fn = next
  if (!fn) return Promise.resolve()

  因为middleware没有下一个了，并且其实外面那个next是空的，所以其实就可以return结束了
  这里其实直接return就行了，这里的return Promise.resolve()其实是没有用的，真正return出外面的是调用第一个中间件的resolve

  看完以下代码你就懂了（其实这就是koa的中间件原理）
  function a() {
    console.log(1)
    b();
    console.log(5)
    return Promise.resolve();
  }
  function b() {
      console.log(2)
      c();
      console.log(4)
  }

  function c() {
      console.log(3)
      return;
  }
  a();
  输出1、2、3、4、5
  */