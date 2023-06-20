//Since these functions use the hardhat library, we cannot have these in our 'helper-hardhat-config'
const { run } = require("hardhat")
const verify = async function verify(contractAddress, args) {
    console.log("Verifying contract.....")
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!")
        } else {
            console.log(e)
        }
    }
}

module.exports = { verify }
