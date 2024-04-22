# jup_staker


网站 https://vote.jup.ag/

## 安装

在项目根目录下，执行以下命令来安装项目依赖：

```bash
npm i
```

首先，打开`JupStake.js` 文件，修改下面的参数：

```javascript
let rpc = "https://mainnet.helius-rpc.com/?api-key=aac42329-3edf-4433-94ec-870600c2ba9e"; // RPC，到https://www.helius.dev/注册获取
const wallet_path = './SOLTestWalle.csv'; // 钱包文件路径
```

## 运行

然后，在项目的根目录下，打开终端，运行以下命令：

```bash
node JupStake.js
```
