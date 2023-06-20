require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const GORELI_RPC_URL = process.env.GORELI_RPC_URL || "https://asdfg.com"
const GORELI_PRIVATE_KEY = process.env.GORELI_PRIVATE_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        goreli: {
            chainId: 5,
            blockConfirmations: 6,
            url: GORELI_RPC_URL,
            accounts: [GORELI_PRIVATE_KEY],
        },
    },
    gasReporter: {
        enabled: false,
        outputFile: "gas-report.txt",
        noColors: true,
        currency: "INR",
        //coinmarketcap: COINMARKETCAP_API_KEY,
        token: "MATIC",
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    solidity: "0.8.8",
    namedAccounts: {
        deployer: {
            default: 0, // Takes first account as the deployer
        },
        player: {
            default: 1,
        },
    },
    mocha: {
        timeout: 500000, // 500 seconds
    },
}
