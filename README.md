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

``` bash
node JupStake.js
```


# JUP_Vote

## 修改投票目标
1. 打开`JupVote.js`文件，按照下面修改第32和33行代码。
2. proposalId从提案的链接获得，voteId先手动做一笔投票后查看交易哈希,具体可以参考下面的图片。
```javascript
// 示例投票链接：https://vote.jup.ag/proposal/DhJAwGDtHYdEy8mBoeZ3Yub5potxRJbvzycYUwhFGfox
// 修改 `proposalId` 为您想要投票的提案 ID
const proposalId = 'DhJAwGDtHYdEy8mBoeZ3Yub5potxRJbvzycYUwhFGfox' // 要投票的提案 ID
const voteId = 2 // 根据实际情况修改 voteId
```

![image-20240505002404754](https://s2.loli.net/2024/05/05/AuQvwG9d6TWxKgb.png)

![image-20240505002617239](https://s2.loli.net/2024/05/05/LU3Dlk4XWeaVs1E.png)



## 运行

然后，在项目的根目录下，打开终端，运行以下命令：

``` bash
node JupVote.js
```


# 