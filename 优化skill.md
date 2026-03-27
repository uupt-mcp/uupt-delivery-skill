# 优化skill注册流程
优化下这个skill，当前需要用户手动配置UUPT_APP_ID、UUPT_APP_SECRET、UUPT_OPEN_ID，对于普通用户来说有点麻烦，现在调整下流程，UUPT_APP_ID和UUPT_APP_SECRET直接固定预制好放在skill中，UUPT_OPEN_ID通过下面的步骤来获取

## UUPT_OPEN_ID获取流程
1. 判断本地文件或者环境变量中是否已包含UUPT_OPEN_ID，如果有则直接使用，如果没有，走下面的获取流程
2. 提示用户输入手机号，发送授权短信验证码，发送短信验证码的url是：/user/unauthorized/sendSmsCode，请求格式，application/json，请求参数userMobile（用户手机号）、userIp（用户公网ip）、imageCode（非必填，图片验证码（接口返回错误码88100106,返回base64图片,提交图片上数字验证码）），请求示例：{"timestamp":1699255082926,"biz":"{\\"userMobile\\":\\"\\",\\"userIp\\":\\"\\",\\"imageCode\\":\\"\\"}","sign":"934EC7D7BFDF56A6AECBFF6A74979A79"}，签名方式和别的请求方法相同，返回{"body":"","code":1,"msg":"ok","state":1,"total":""},接口返回code等于88100106,解析msg成base64图片,让用户输入图片上数字验证码后重新调用这个发送短信的接口
3. 短信接口发送成功后，提示用户输入短信验证码，调用商户授权接口，接口的url是/user/unauthorized/auth，请求参数：userMobile（用户手机号）、userIp（用户公网ip）、smsCode（短信验证码）、cityName（固定传“郑州市”）、countyName（不用填），请求示例：{"timestamp":1699255082926,"biz":"{\\"userMobile\\":\\"\\",\\"userIp\\":\\"\\",\\"smsCode\\":\\"\\",\\"cityName\\":\\"\\",\\"countyName\\":\\"\\"}","sign":"934EC7D7BFDF56A6AECBFF6A74979A79"}，签名方式和别的请求方法相同，返回{"body":{"openId":""},"code":1,"msg":"ok","state":1,"total":""},拿到openId后保存到本地配置文件中
4. 如果授权接口失败则重新走一遍发送短信（此时不用再输入手机号）、商户授权流程，最多重试3次
