const { assert, expect } = require("chai")
const { network, getNamedAccounts, ethers } = require("hardhat")
const chainId = network.config.chainId

chainId == 31337
    ? describe.skip
    : describe("Lottery Staging test", function () {
          let lottery, entranceFee, deployer
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              lottery = await ethers.getContract("Lottery", deployer)
              entranceFee = await lottery.getEntranceFee()
          })

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink VRF and Chainlink Keepers, and generates a random winner", async function () {
                  console.log("Setting up test..")
                  const startingTimestamp = await lottery.getLastTimeStamp()
                  const accounts = await ethers.getSigners()

                  console.log("Setting up listener..")
                  await new Promise(async function (resolve, reject) {
                      //Set up the listener before we enter the lottery
                      //In case the blockchain moves really fast
                      lottery.once("WinnerPicked", async () => {
                          console.log("Winner has been picked and event got fired!")
                          try {
                              //adding asserts
                              const currentState = await lottery.getCurrentState()
                              const currentTimestamp = await lottery.getLastTimeStamp()
                              const recentWinner = await lottery.getRecentWinner()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              await expect(lottery.getPlayer(0)).to.be.reverted
                              assert.equal(currentState.toString(), "0")
                              assert.equal(recentWinner.toString(), accounts[0].address.toString())
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(entranceFee).toString()
                              )
                              assert(currentTimestamp > startingTimestamp)
                              resolve()
                          } catch (e) {
                              reject(e)
                          }
                      })

                      console.log("Entering the lottery..")
                      //Entering the raffle
                      txResponse = await lottery.enterLottery({ value: entranceFee })
                      await txResponse.wait(1)
                      console.log(`Time to wait....`)
                      const winnerStartingBalance = await accounts[0].getBalance()

                      //This code won't complete until the listener has finished listening.
                  })
              })
          })
      })
