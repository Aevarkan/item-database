// About the project

// QIDB - QUICK ITEM DATABASE
// GitHub:          https://github.com/Carchi777/QUICK-ITEM-DATABASE
// Discord:         https://discord.com/channels/523663022053392405/1252014916496527380

// Made by Carchi77
// My Github:       https://github.com/Carchi777
// My Discord:      https://discordapp.com/users/985593016867778590

/**
 * TypeScript implementation by Aevarkan (https://github.com/Aevarkan)
 * Changes:
 * Only one error is thrown for an invalid namespace. This is thrown during the constructor.
 * The database only returns ItemStack arrays instead of single ItemStack instances
 * Namespace is mandatory, you cannnot put an empty namespace (that's seriously bad practice!)
 * 
 * Targeted SAPI version: 2.1.0-beta (2.1.0-rc.1.21.100-preview.20)
 * There may or may not be TypeScript compiler errors depending on your target version and whether or not you have strict checks.
 * These errors shouldn't affect functionality, however.
 */

import { world, system, ItemStack, Entity, Dimension, StructureSaveMode, EntityComponentTypes, Vector3, Container, EntityInventoryComponent, Player } from '@minecraft/server';

function date() {
    const date = new Date(Date.now())
    const ms = date.getMilliseconds().toString().padStart(3, "0")
    return `${date.toLocaleString().replace(' AM', `.${ms} AM`).replace(' PM', `.${ms} PM`)}`
}

/**
 * Logs an action to console, adding a prefix.
 * @param message The message to log.
 * @param logType The priority of the log.
 * @param showStackTrace Whether to show the stack trace after the error.
 */
function logAction(message: any, logType: LogTypes, showStackTrace = false) {
    let prefixedMessage = "QIDB > " + message

    switch (logType) {
        case LogTypes.warn:
            prefixedMessage = "§6" + prefixedMessage
            console.warn(prefixedMessage)
            break

        case LogTypes.error:
            prefixedMessage = "§c" + prefixedMessage
            console.error(prefixedMessage)
            break

        case LogTypes.log:
        default:
            prefixedMessage = "§a" + prefixedMessage
            console.log(prefixedMessage)
            break
    }

    if (showStackTrace) console.trace()
}

enum LogTypes {
    log,
    warn,
    error
}

interface ItemDatabaseSettings {
    namespace: string,
    cacheSize: number,
    saveRate: number
}

interface ItemDatabaseEntry {
    key: string,
    value: ItemStack[]
}

export interface ItemDatabaseLogSettings {
    startUp: boolean,
    save: boolean,
    load: boolean,
    set: boolean,
    get: boolean,
    has: boolean,
    delete: boolean,
    clear: boolean,
    values: boolean,
    keys: boolean,
}

const defaultLogs: ItemDatabaseLogSettings = {
    startUp: true,
    save: true,
    load: false,
    set: false,
    get: false,
    has: false,
    delete: false,
    clear: true,
    values: false,
    keys: false,
}

export class QuickItemDatabase {

    /**
     * The number of ticks per second in Minecraft is normally 20.
     */
    private static readonly TICKS_PER_SECOND: number = 20
    /**
     * The entity used for storing items.
     */
    private static readonly STORAGE_ENTITY: string = "qidb:storage"
    /**
     * The number of inventory slots the storage entity has.
     */
    private static readonly STORAGE_ENTITY_CAPACITY: number = 256
    /**
     * The namespace for QIDB only allows lower and uppercase English characters, numbers 0 to 9, and the underscore _.
     */
    private static readonly VALID_NAMESPACE: RegExp = /^[A-Za-z0-9_]+$/
    /**
     * QIDB is reserved internally for the database.
     */
    private static readonly RESERVED_NAMEPSACE: RegExp = /qidb/i
    /**
     * The prefix of the dynamic property used when initialising.
     * @remarks
     * This is reserved by the database and enforced by the regular expression above.
     */
    private static readonly DYNAMIC_PROPERTY_PREFIX: string = "qidb"
    /**
     * The Y level where the entities are spawned in.
     */
    private static readonly SPAWN_LOCATION_Y_COORDINATE: number = 318
    /**
     * The delay between saving each entry in seconds.
     */
    private static readonly SAVE_DELAY_SECONDS: number = 6
    /**
     * The name of the ticking area used for database operations.
     */
    private static readonly TICKING_AREA_NAME: string = "storagearea"

    /**
     * `ItemStack[]`s that are currently stored in memory instead of in a structure.
     */
    private quickAccess: Map<string, ItemStack[]>
    /**
     * Entries that are currently waiting to be saved
     */
    private queuedEntries: ItemDatabaseEntry[]
    /**
     * Where the storage entity will be spawned.
     */
    private spawnLocation!: Vector3
    /**
     * Contains the database settings.
     */
    private readonly settings: ItemDatabaseSettings
    /**
     * Object that describes the actions that should be logged to console.
     */
    private readonly logs: ItemDatabaseLogSettings
    /**
     * The dimension that the storage entities will be spawned in.
     */
    private dimension!: Dimension

    /**
     * Creates a new QuickItemDatabase instance.
     * 
     * @param namespace
     * The unique namespace for the database identifiers. This will be the prefix used before the colon `:` in the structure's name.
     * 
     * Supports lower and uppercase English characters, numbers 0 to 9, and the underscore `_`.
     * 
     * `qidb` is reserved internally for the database.
     * 
     * @param cacheSize
     * The max amount of entries to keep quickly accessible. A small size can cause lag on frequent iterated usage, a large number can cause high hardware RAM usage.
     * 
     * The default size is 50 elements.
     * 
     * @param saveRate
     * The background saves per tick (high performance impact).
     * 
     * The default `saveRate` of 1 is 20 entries per second.
     * 
     * @param logSettings The database actions that should be logged to console.
     * 
     * @throws Throws if an invalid namespace is provided.
     * 
     * @remarks
     * This should be initialised in the global namespace, not doing so can lead to errors.
     * 
     * This database uses dynamic properties with the `qidb` prefix internally which may pollute your environment.
     */
    constructor(namespace: string, cacheSize: number = 50, saveRate: number = 1, logSettings: ItemDatabaseLogSettings = defaultLogs) {
        this.settings = {
            namespace: namespace,
            cacheSize: cacheSize,
            saveRate: saveRate
        }
        this.queuedEntries = []
        this.quickAccess = new Map()
        // We need to assign the dimension later due to early execution
        // this.dimension = world.getDimension("minecraft:overworld")


        // Check the namespace, if its bad, then we stop immediately
        if (!(QuickItemDatabase.VALID_NAMESPACE.test(namespace))) {
            logAction(`${namespace} isn't a valid namespace. accepted char: A-Z a-z 0-9 _ §r${date()}`, LogTypes.error)
            throw new Error(`Invalid namespace: ${namespace}`)
        } else if (QuickItemDatabase.RESERVED_NAMEPSACE.test(namespace)) {
            logAction(`${namespace} is using the reserved "QIDB" namespace. ${date()}`, LogTypes.error)
            throw new Error(`Reserved namespace: ${namespace}`)
        }

        // Apply the log settings
        this.logs = logSettings

        // 2.0 requires this due to early execution
        system.run(() => {
            this.dimension = world.getDimension("minecraft:overworld")

            this._start()
        })
        
    }

    /**
     * Adds an entry to the database..
     * @param identifier The itemstack identifier.
     * @param value The `ItemStack[]` or `ItemStack` value to set.
     * @throws Throws if `value` is an `ItemStack` array that has more than 1024 items.
     * @remarks
     * This function **can** be called in read-only mode, but the item is saved later in the tick. 
     * 
     * The maximum array size is 1024 elements.
     */
    public set(identifier: string, value: ItemStack[] | ItemStack): void {
        const time = Date.now();
        const fullKey = this.settings.namespace + ":" + identifier

        // Put the ItemStack into an array if its not already
        let itemStackArray = value
        if (!(Array.isArray(itemStackArray))) {
            itemStackArray = [itemStackArray]
        }

        // Throw an error if trying to save more than 1024 ItemStacks
        if (itemStackArray.length > 1024) {
            logAction(`Out of range: <${fullKey}> has more than 1024 ItemStacks §r${date()}`, LogTypes.error)
            throw new Error(`§cQIDB > Out of range: <${fullKey}> has more than 1024 ItemStacks §r${date()}`)
        }

        // Add the dynamic property key to the database
        const entitiesRequired = Math.max(Math.floor((itemStackArray.length - 1) / QuickItemDatabase.STORAGE_ENTITY_CAPACITY) + 1, 1)
        world.setDynamicProperty(fullKey, entitiesRequired)

        // Add to memory cache, overriding any old ones
        // Removing the entry first refreshes it and moves it to the end of the deletion queue
        this.quickAccess.delete(fullKey)
        this.quickAccess.set(fullKey, itemStackArray)
        // Remove any in the queue and add the new one at the top
        const duplicateIndex = this.queuedEntries.findIndex(entry => entry.key === fullKey)
        if (duplicateIndex !== -1) {
            this.queuedEntries.splice(duplicateIndex, 1)
        }

        // Queue saving the entry to disk
        this.queueSave(fullKey, itemStackArray)

        // Logging
        if (this.logs.set) {
            logAction(`Set key <${fullKey}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
        }
    }

    /**
     * Gets an itemstack stored in the database's cache.
     * @param identifier The itemstack identifier.
     * @returns The `ItemStack[]` saved in cache, or `undefined` if it is not present.
     * @throws Throws if the given identifier is not defined.
     * @remarks
     * This function can be called in read-only mode as it only checks the cache.
     * 
     * `ItemStack` singletons saved using `set` will still return an array.
     */
    public quickGet(identifier: string): ItemStack[] | undefined {
        // Undefined check
        if (identifier === undefined) {
            throw new Error(`§cQIDB > The identifier is not defined.`)
        }

        const time = Date.now();
        const fullKey = this.settings.namespace + ":" + identifier

        const itemStack = this.quickAccess.get(fullKey)

        if (this.logs.get) {
            if (itemStack) {
                logAction(`Got items from cache <${fullKey}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
            } else {
                logAction(`Entry <${fullKey}> does not exist in cache. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
            }
        }
        return itemStack
    }

    /**
     * Gets the itemstack from an identifier.
     * @param identifier The itemstack identifier.
     * @returns The `ItemStack[]` saved as `identifier`, or `undefined` if it is not present.
     * @throws Throws if the given identifier is not defined.
     * @remarks
     * This function can't be called in read-only mode.
     * 
     * Single `ItemStack`s saved using `set` will still return an array.
     */
    public get(identifier: string): ItemStack[] | undefined {

        // Undefined check
        if (identifier === undefined) {
            throw new Error(`§cQIDB > The identifier is not defined.`)
        }

        const time = Date.now();
        const fullKey = this.settings.namespace + ":" + identifier

        // Try quick access cache first
        if (this.quickAccess.has(fullKey)) {
            if (this.logs.get) {
                logAction(`Got items from cache <${fullKey}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
            }
            return this.quickAccess.get(fullKey) as ItemStack[]
        }

        // Now we'll have to get the structure saved on disk
        const structure = world.structureManager.get(fullKey)
        if (!structure) {
            logAction(`The key < ${fullKey} > doesn't exist.`, LogTypes.error)
            return undefined
        }
        // Get the containers
        const { existingStructure, containers } = this.getInventories(fullKey)
        const items: ItemStack[] = []
        containers.forEach((inv, index) => {
            for (let i = 256 * index; i < 256 * index + 256; i++) items.push(inv.getItem(i - 256 * index) as ItemStack);
            for (let i = 256 * index + 255; i >= 0; i--) if (!items[i]) items.pop(); else break;
        })
        this.saveStructure(fullKey, existingStructure);

        if (this.logs.get) {
            logAction(`Got items from <${fullKey}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
        }

        // Add the item we just got to cache
        this.quickAccess.set(fullKey, items)
        return items
    }

    /**
     * Checks if an entry exists in the item database's cache.
     * @param identifier The itemstack identifier.
     * @returns `true` if the entry exists, `false` if the entry doesn't exist.
     * @remarks This function can be called in read-only mode as it only checks the cache.
     */
    public quickHas(identifier: string): boolean {
        const fullKey = this.settings.namespace + ":" + identifier

        return this.quickAccess.has(fullKey)
    }

    /**
     * Checks if a key exists in the item database.
     * @param identifier The itemstack identifier.
     * @returns `true` if the key exists, `false` if the key doesn't exist.
     * @remarks This function can't be called in read-only mode.
     */
    public has(identifier: string): boolean {
        const time = Date.now();
        const fullKey = this.settings.namespace + ":" + identifier

        // The key doesn't exist, and we must prove it does
        let keyExists = false
        if (this.quickAccess.has(fullKey)) {
            keyExists = true
        } else if (world.structureManager.get(fullKey)) {
            keyExists = true
        }

        if (this.logs.has) {
            if (keyExists) {
                logAction(`Found entry <${fullKey}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
            } else {
                logAction(`Entry <${fullKey}> doesn't exist in database. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
            }
        }

        return keyExists
    }

    /**
     * Deletes an entry from the item database.
     * @param identifier The itemstack identifier.
     * @returns `true` if the entry existed, `false` if it didn't.
     * @remarks This function can't be called in read-only mode.
     */
    public delete(identifier: string): boolean {
        const time = Date.now()
        const fullKey = this.settings.namespace + ":" + identifier

        // Delete from the cache and delete the structure from world
        const inCache = this.quickAccess.delete(fullKey)
        const inStructure = world.structureManager.delete(fullKey)

        // If the entry existed, we clear the dynamic property
        let entryExisted = false
        if (inCache || inStructure) {
            world.setDynamicProperty(fullKey, undefined)
            entryExisted = true
        }

        // Logging
        if (this.logs.delete) {
            const timeDifference = Date.now() - time
            if (entryExisted) {
                logAction(`Deleted entry <${fullKey}> succesfully. ${timeDifference}ms §r${date()}`, LogTypes.log)
            } else {
                logAction(`The entry <${fullKey}> doesn't exist. ${timeDifference}ms §r${date()}`, LogTypes.log)
            }
        }

        return entryExisted
    }

    /**
     * Gets all the keys of your namespace from item database.
     * @returns All the keys as an array of strings.
     */
    public keys(): string[] {
        const allIds = world.getDynamicPropertyIds()
        const ids: string[] = []
        allIds.filter(id => id.startsWith(this.settings.namespace + ":")).forEach(id => ids.push(id.replace(this.settings.namespace + ":", "")))
        if (this.logs.keys) {
            logAction(`Got the list of all the ${ids.length} keys. §r${date()}`, LogTypes.log)
        }

        return ids
    }

    /**
     * Gets all `ItemStack[]` arrays stored currently stored in the database.
     * @returns All values as an `ItemStack[]` array.
     * @remarks This function can't be called in read-only mode.
     */
    public values(): ItemStack[][] {
        const time = Date.now();
        const allIds = world.getDynamicPropertyIds()
        const values: ItemStack[][] = []
        const filtered = allIds.filter(id => id.startsWith(this.settings.namespace + ":")).map(id => id.replace(this.settings.namespace + ":", ""))
        for (const key of filtered) {
            const value = this.get(key)
            if (value) {
                values.push(value)
            }
        }
        if (this.logs.values) {
            logAction(`Got the list of all the ${values.length} values. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
        }
        return values
    }

    /**
     * Clears all, CAN NOT REWIND.
     * @remarks
     * This function can't be called in read-only mode.
     * 
     * This clears all structures that are using the namespace that also have a key in the database.
     * This can possibly include your own ones.
     */
    public clear() {
        const time = Date.now();
        const allIds = world.getDynamicPropertyIds()
        const filtered = allIds.filter(id => id.startsWith(this.settings.namespace + ":")).map(id => id.replace(this.settings.namespace + ":", ""))
        for (const key of filtered) {
            this.delete(key)
        }
        if (this.logs.clear) {
            logAction(`Cleared, deleted ${filtered.length} values. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
        }
    }

    /**
     * Initialisation logic for the database.
     */
    private _start() {
        const startLog = () => {
            logAction(`Initialized successfully.§r namespace: ${this.settings.namespace} §r${date()}`, LogTypes.log)
            if (this.settings.saveRate > 1) {
                logAction(`Using a saveRate bigger than 1 can cause slower game ticks and extreme lag while saving 1024 size entries. at <${this.settings.namespace}> §r${date()}`, LogTypes.warn)
            }
        }

        const initialiseLocation = (player: Player) => {
            // Get the location for the ticking area and subsequent spawn if already set
            const initialisedKey = QuickItemDatabase.DYNAMIC_PROPERTY_PREFIX + ":initialised"
            const xLocationKey = QuickItemDatabase.DYNAMIC_PROPERTY_PREFIX + ":x"
            const zLocationKey = QuickItemDatabase.DYNAMIC_PROPERTY_PREFIX + ":z"
            let xLocation = world.getDynamicProperty(xLocationKey) as number | undefined
            let zLocation = world.getDynamicProperty(zLocationKey) as number | undefined
            const wasInitialised = world.getDynamicProperty(initialisedKey) as boolean | undefined

            // If the locations aren't already set from a previous
            // session, then we get them from the player
            if (xLocation === undefined) {
                xLocation = player.location.x
                world.setDynamicProperty(xLocationKey, xLocation)
            }
            if (zLocation === undefined) {
                zLocation = player.location.z
                world.setDynamicProperty(zLocationKey, zLocation)
            }

            // We can set the spawn location now that we have both x and z
            this.spawnLocation = { x: xLocation, y: QuickItemDatabase.SPAWN_LOCATION_Y_COORDINATE, z: zLocation }

            // If the ticking area wasn't created yet, we create it
            if (!wasInitialised) {
                world.setDynamicProperty(initialisedKey, true)
                const oneAboveSpawm = this.spawnLocation.y + 1

                // Same as writing it into one string, but this is easier to read
                const tickingAreaCommand = [
                    "tickingarea add",
                    this.spawnLocation.x, oneAboveSpawm, this.spawnLocation.z,
                    this.spawnLocation.x, this.spawnLocation.y, this.spawnLocation.z,
                    QuickItemDatabase.TICKING_AREA_NAME
                ].join(" ")

                this.dimension.runCommand(tickingAreaCommand)
            }

            // Now display the start log
            startLog()
        }

        // Check if there's a player spawned in
        const existingPlayer = world.getPlayers()[0] as Player | undefined
        if (existingPlayer) {
            // Call that function we just defined
            initialiseLocation(existingPlayer)
        } else {
            // If there's no player, then we wait for one to spawn in
            const spawnListener = world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
                if (!initialSpawn) return
                
                initialiseLocation(player)
                world.afterEvents.playerSpawn.unsubscribe(spawnListener)
            })
        }

        this._run()
        this._registerShutdown()
    }

    /**
     * Functionality for actually saving the database entries.
     */
    private _run() {
        const log = () => {
            const entriesSavedSinceLast = lastAmountSaved - this.queuedEntries.length
            const saveRate = (entriesSavedSinceLast / QuickItemDatabase.SAVE_DELAY_SECONDS).toFixed(0) || "//"
            lastAmountSaved = this.queuedEntries.length
            logAction(`Saving, Dont close the world.\n§r[Stats]-§eRemaining: ${this.queuedEntries.length} entries | speed: ${saveRate} entries/s §r${date()}`, LogTypes.log)
        }

        let wasSavingLastTick = false
        let runId: number | undefined
        let lastAmountSaved: number = 0
        system.runInterval(() => {
            // Clear items from the cache if it's too big
            const cacheSettingDiff = this.quickAccess.size - this.settings.cacheSize;
            if (cacheSettingDiff > 0) {
                for (let i = 0; i < cacheSettingDiff; i++) {
                    const nextEntry = this.quickAccess.keys().next()?.value
                    if (nextEntry) {
                        this.quickAccess.delete(nextEntry)
                    }
                }
            }

            // If there are entries to save, make a new run, or save
            if (this.queuedEntries.length) {

                if (runId === undefined) {
                    if (this.logs.save) {
                        log()
                    }

                    runId = system.runInterval(() => {
                        if (this.logs.save) {
                            log()
                        }

                    }, QuickItemDatabase.SAVE_DELAY_SECONDS * QuickItemDatabase.TICKS_PER_SECOND)
                }
                wasSavingLastTick = true
                const k = Math.min(this.settings.saveRate, this.queuedEntries.length)
                for (let i = 0; i < k; i++) {
                    const entryToSave = this.queuedEntries.shift()
                    if (entryToSave) {
                        this.save(entryToSave.key, entryToSave.value);
                    }
                }
            } else if (runId) {
                system.clearRun(runId)
                runId = undefined
                if (wasSavingLastTick && this.logs.save)  {
                    logAction(`Saved, You can now close the world safely. §r${date()}`, LogTypes.log)
                }
                wasSavingLastTick = false
            }
        }, 1)
    }

    /**
     * Subscribes to the shutdown event to give a notification.
     */
    private _registerShutdown() {
        // Error notification if shutdown leads to lost data.
        // This does not attempt to save the data as it is too late to do so.
        system.beforeEvents.shutdown.subscribe(() => {
            if (this.queuedEntries.length) {
                logAction(
                    `Fatal Error >§r§c World closed too early, items not saved correctly.  \n\n` +
                    `Namespace: ${this.settings.namespace}\n` +
                    `Number of lost entries: ${this.queuedEntries.length} §r${date()}\n\n\n\n`,
                    LogTypes.error
                )
            }
        })
    }

    /**
     * Gets the inventories of the storage entities.
     * @param fullKey The whole structure id, including the prefix.
     * @param requiredEntities
     * The number of entities required to contain all inventories. Each entity can store a maximum of 256 slots.
     * 
     * Not required when loading inventories.
     * 
     * @returns The {@link Container}s of the storage entities, and whether or not there was an existing structure.
     * @remarks
     * This spawns in empty entities if the value for the key doesn't exist.
     * 
     * This function can't be called in read-only mode.
     */
    private getInventories(fullKey: string, requiredEntities?: number) {
        // Check the key length, we don't accept longer than 30 characters
        // This character limit includes the prefix and the colon.
        if (fullKey.length > 30) {
            logAction(`Out of range: <${fullKey}> has more than 30 characters §r${date()}`, LogTypes.error)
            throw new Error(`§cQIDB > Out of range: <${fullKey}> has more than 30 characters §r${date()}`)
        }

        // Get the existing structure if it's there, otherwise spawn in new storage entities
        let existingStructure = false
        const structure = world.structureManager.get(fullKey)
        if (structure) {
            world.structureManager.place(structure, this.dimension, this.spawnLocation, { includeEntities: true })
            existingStructure = true
        } else {
            logAction(requiredEntities, LogTypes.log)
            if (requiredEntities) {
                for (let i = 0; i < requiredEntities; i++) {
                    // @ts-expect-error <typeof QuickItemDatabase.STORAGE_ENTITY> is simply there to stop TypeScript errors.
                    this.dimension.spawnEntity<typeof QuickItemDatabase.STORAGE_ENTITY>(QuickItemDatabase.STORAGE_ENTITY, this.spawnLocation)
                }
            }
        }

        // Now get those storage entities
        const entities: Entity[] = this.dimension.getEntities({ location: this.spawnLocation, type: QuickItemDatabase.STORAGE_ENTITY })
        if (requiredEntities) {
            // Spawn more storage entities if needed
            if (entities.length < requiredEntities) {
                for (let i = entities.length; i < requiredEntities; i++) {
                    // @ts-expect-error <typeof QuickItemDatabase.STORAGE_ENTITY> is simply there to stop TypeScript errors.
                    entities.push(this.dimension.spawnEntity<typeof QuickItemDatabase.STORAGE_ENTITY>(QuickItemDatabase.STORAGE_ENTITY, this.spawnLocation))
                }
            }
            // Vice versa if there are more entities than needed
            if (entities.length > requiredEntities) {
                logAction(`entities.length > length: ${entities.length} > ${requiredEntities} ${entities.length > requiredEntities}`, LogTypes.log)
                for (let i = entities.length; i > requiredEntities; i--) {
                    logAction(`removed ${i}`, LogTypes.log)
                    entities[i - 1].remove()
                    entities.pop()
                }
            }
        }

        // Now get their inventories
        const containers: Container[] = []
        entities.forEach(entity => {
            containers.push((entity.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent).container)
        })

        if (this.logs.load) {
            logAction(`Loaded ${entities.length} entities <${fullKey}> §r${date()}`, LogTypes.log)
        }
        return { existingStructure, containers }
    }

    /**
     * Saves a structure to the world
     * @param key The identifier of the structure.
     * @param existingStructure Whether or not the structure already exists. This must be determined from elsewhere.
     */
    private async saveStructure(key: string, existingStructure: boolean) {
        // Delete the structure if it exists
        if (existingStructure) world.structureManager.delete(key)

        // Now create the new structure
        world.structureManager.createFromWorld(key, this.dimension, this.spawnLocation, this.spawnLocation, { saveMode: StructureSaveMode.World, includeEntities: true });
        
        // Delete the storage entities
        const entities = this.dimension.getEntities({ location: this.spawnLocation, type: QuickItemDatabase.STORAGE_ENTITY });
        entities.forEach(e => e.remove());
    }

    /**
     * Queues a key-itemstack pair for saving.
     * @param key The identifier for the pair, this will be the name of the structure.
     * @param value The itemstacks to save.
     */
    private queueSave(key: string, value: ItemStack[]) {
        const entry: ItemDatabaseEntry = {
            key: key,
            value: value
        }
        this.queuedEntries.push(entry)
    }

    /**
     * Saves itemstacks into a structure.
     * @param key The structure identifier.
     * @param value The itemstacks to save.
     * @remarks Clears the inventory of the storage entity if `value` is undefined.
     */
    private async save(key: string, value: undefined | ItemStack | ItemStack[]) {
        // Get the number of storage entities we'll need to store the items
        let requiredEntities = 1
        const isArray = Array.isArray(value)
        if (isArray) {
            requiredEntities = Math.floor((value?.length - 1) / QuickItemDatabase.STORAGE_ENTITY_CAPACITY) + 1 || 1
        }

        // Get the inventories to place the items in
        const { existingStructure, containers } = this.getInventories(key, requiredEntities)

        // Place the items
        containers.forEach((inv, index) => {
            // If undefined, then clear inventories
            if (!value) for (let i = 256 * index; i < 256 * index + 256; i++) inv.setItem(i - 256 * index, undefined), world.setDynamicProperty(key, undefined);
            // Otherwise save them
            if (isArray) {
                try { for (let i = 256 * index; i < 256 * index + 256; i++) inv.setItem(i - 256 * index, value[i] || undefined) } catch { throw new Error(`§cQIDB > Invalid value type. supported: ItemStack | ItemStack[] | undefined §r${date()}`) }
                world.setDynamicProperty(key, requiredEntities)
            } else {
                try { inv.setItem(0, value), world.setDynamicProperty(key, false) } catch { throw new Error(`§cQIDB > Invalid value type. supported: ItemStack | ItemStack[] | undefined §r${date()}`) }
            }
        })

        // Now save it onto disk
        await this.saveStructure(key, existingStructure);
    }

}
