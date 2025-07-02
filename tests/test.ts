/**
 * Quick Item Database
 * This is standalone testing code that can be run to test the database. Note that the path to QuickItemDatabase may change.
 * 
 * This will save the itemstack you are currently holding when you interact with a block, and return it to you when you emote.
 * Jumping will delete your item from the database.
 */

import { ButtonState, EntityComponentTypes, EntityInventoryComponent, InputButton, world } from "@minecraft/server";
import { ItemDatabaseLogSettings, QuickItemDatabase } from "@src/QuickItemDatabase";

const allLogs: ItemDatabaseLogSettings = {
    startUp: true,
    save: true,
    load: true,
    set: true,
    get: true,
    has: true,
    delete: true,
    clear: true,
    values: true,
    keys: true,
}

const itemIdentifier = "heldItem"
const itemDatabase = new QuickItemDatabase("testing", 50, 1, allLogs)

world.afterEvents.playerInteractWithBlock.subscribe(event => {
    const itemToSave = event.itemStack
    if (!itemToSave) return

    itemDatabase.set(itemIdentifier, itemToSave)
    event.player.sendMessage("Saved your currently held item!")
})

world.afterEvents.playerEmote.subscribe(({player}) => {
    const storedItem = itemDatabase.get(itemIdentifier)
    if (!storedItem) {
        player.sendMessage("You have no stored item!")
        return
    }

    const container = (player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent).container
    container.addItem(storedItem[0])
    player.sendMessage("Returned your item!")
})

world.afterEvents.playerButtonInput.subscribe(({button, newButtonState, player}) => {
    if (!(button === InputButton.Jump && newButtonState === ButtonState.Pressed)) return

    itemDatabase.delete(itemIdentifier)
    player.sendMessage("Delted your item!")
})