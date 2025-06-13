import { world, system, ItemStack, Player } from '@minecraft/server';

import { QIDB } from './QIDB.js' // new name of the file (shorter)

// initalize database using 270 slots for quick access and 10 inventories saves per tick
const Inventories = new QIDB('inventories', 10, 270) // logs are optional


// using chatsend to simulate a command
world.beforeEvents.chatSend.subscribe(e => {

    const { sender: player, message } = e
    if (message != '.swap') return;
    else e.cancel = true

    system.run(() => {
        
        // handling the swapper algorithm
        const invNum = player.getDynamicProperty('invNum') || 1

        const newInvNum = invNum == 1 ? 2 : 1

        const inv = player.getComponent('inventory').container

        const newKey = `${player.id.replace('-', '')}_${newInvNum}`
      
        // get the second inv only if the player has it alredy saved
        const newInv = Inventories.has(newKey) ? Inventories.get(newKey) : [];

        const oldInv = []

        for (let i = 0; i < inv.size; i++) {
            oldInv.push(inv.getItem(i))
            inv.setItem(i, newInv[i])
        }
        const key = `${player.id.replace('-', '')}_${invNum}`

        Inventories.set(key, oldInv) // save the inv in the database (max 255 items)

        player.setDynamicProperty('invNum', newInvNum)
    })
})


