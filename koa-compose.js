'use strict'

// koa-compose模块可以将多个中间件函数合并成一个大的匿名函数
// 然后调用这个匿名函数就可以依次执行通过app.use()注册的中间件函数

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

// compose函数需要传入一个中间件函数数组 [f1, f2, f3,...] 
// 返回一个匿名函数
function compose (middleware) {
  // 如果传入的不是数组，则抛出错误
  if (!Array.isArray(middleware)) throw new TypeError('Middleware stack must be an array!')
  // 数组中有一项不为函数，则抛出错误
  for (const fn of middleware) {
    if (typeof fn !== 'function') throw new TypeError('Middleware must be composed of functions!')
  }

  /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */
  // compose函数被调用后，返回的是以下这个匿名函数
  // 该函数接收两个参数，结合koa源码中的 callback 方法和 handleRequest 方法 可以看出
  // 第一个参数context 就是koa的请求上下文ctx对象
  // 第二个参数next 是所有中间件执行完后，框架使用者来最后处理请求和返回的回调函数
  // 这个匿名函数返回一个promise
  return function (context, next) {
    // last called middleware #
    let index = -1 // 初始下标为-1
    return dispatch(0)
    function dispatch (i) {
      // 正常情况下在这里: i > index;
      // 下面这一行是为了确保在一个中间件中next只调用一次 若是两次执行next()就会报出这个错误 将状态rejected
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i
      let fn = middleware[i]
      // 当满足 i === middleware.length 条件时 说明所有中间件实际上已经执行完毕了
      // 此时的fn === undefined 这里将其再赋值为 next 函数（此next函数指的是42行的参数next而不是koa中间件的next)
      if (i === middleware.length) fn = next
      if (!fn) return Promise.resolve() // 自此开始中间件回执
      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
        // 上面一行实际上等价于
        /*
        return Promise.resolve(fn(context, function () {
          return dispatch(i + 1)
        }))
        */

        // 所以koa中间件函数中的第二个参数 next实际上就是以下匿名函数：
        /*
        function () {
          return dispatch(i + 1)
        }
        */

        // 所以在中间件中执行到 await next() 这一句的时候
        // await next() => await dispatch(i + 1) => await Promise.resolve(middleware[i + 1])
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}


// ===========================================================================================================
// 其实这部分要跟koa源码中 application.js中的callback 结合起来看

/**
  * Shorthand for:
  *
  *    http.createServer(app.callback()).listen(...)
  *
  * @param {Mixed} ...
  * @return {Server}
  * @api public
  */
/*
listen(...args) {
  debug('listen');
  const server = http.createServer(this.callback());
  return server.listen(...args);
}
*/

/**
  * Return a request handler callback
  * for node's native http server.
  *
  * @return {Function}
  * @api public
  */

/*
callback() {
  // koa-compose 单从语义上看就是组合，其实就是将所有的koa中间件合并成一个匿名函数
  // 并且该匿名函数的返回值将是一个Promise
  const fn = compose(this.middleware);

  if (!this.listenerCount('error')) this.on('error', this.onerror);

  // listen()中的 this.callback() 方法返回的函数实际上就是 http.createServer()的参数函数
  const handleRequest = (req, res) => {
    const ctx = this.createContext(req, res); // 根据node.js原生的req, res对象生成一个ctx对象(请求上下文对象) 作为中间件函数的第一个参数
    return this.handleRequest(ctx, fn);
  };

  return handleRequest;
}
*/

/**
  * Handle request in callback.
  *
  * @api private
  */
/*
handleRequest(ctx, fnMiddleware) {
  const res = ctx.res;
  res.statusCode = 404;
  const onerror = err => ctx.onerror(err);
  const handleResponse = () => respond(ctx);
  onFinished(res, onerror);
  // 这里之传递了ctx 并没有next
  return fnMiddleware(ctx).then(handleResponse).catch(onerror);
}
*/

/*
当然我们关心的是如何对中间件组合，其实就是传入一个middleware数组，然后依次顺序取出每个中间件，传入context和next，执行每个中间件
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
*/

// ===========================================================================================================
/*
看完以下代码你就懂了（其实这就是koa的中间件原理）

async function f1 () {
  console.log(1)
  await Promise.resolve(f2());
  console.log(6)
}

async function f2 () {
  console.log(2)
  await Promise.resolve(f3());
  console.log(5)
}

async function f3 () {
  console.log(3)
  await Promise.resolve();
  console.log(4)
}

const fn = () => {
  return Promise.resolve(f1());
};

fn()

输出：1 2 3 4 5 6
*/
