const { network, ethers } = require("hardhat")

const BASE_FEE = ethers.utils.parseEther("0.25") //taken from the Chainlink website
const GAS_PRICE_LINK = 1e9 // LINK per gas
module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (chainId == 31337) {
        //deploying mock contract since we are on a local network
        log("Local network detected....deploying mocks..")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        })

        log("Mocks Deployed!!")
        log("---------------------------------------------------")
        log("You are deploying to a local network, you'll need a local network running to interact")
        log(
            "Please run `yarn hardhat console --network localhost` to interact with the deployed smart contracts!"
        )
    }
}

module.exports.tags = ["all", "mocks"]
