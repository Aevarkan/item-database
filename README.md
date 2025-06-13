# Item Database
This is a TypeScript implementation of the original database.

This is **not** a drop-in replacement; there are a few changes:
- You **must** have a namespace, it is not optional
- The return type for `get` is **only** an `ItemStack` array, not single `ItemStack` instances

# Original Description
## introduction
I made this to fix the **main issue** of Minecraft's script api: **you cant save ItemStacks in a dynamic property**, and if you try to stringify its properties you will still loose some of them that are unreacheable with scripts. **This database fixes this problem using structures saving perfect item clones, making it easy, reliable and fast**....

## How does it work?

- This database uses **structures** to save items, it uses an **entity with 255 slots** instead of just dropped items to minimize the lag of the loaded entities, this makes the database have **255 items per key**.

## Features
- **Keys are unlimited**, they re handled by the QIDB class where you put namespace, **cache** size, saves per tick(may change) and developer debug **logs**.

- Cache memory requires a lot of **ram** so i added an option to **limit the cached key amount**.

- Background Saving is made with a **runinterval** that saves an amount of **keys per tick**, to not overload or freeze the game, in **V3.8.4** it uses **RunJob** that may cause** lag** in some devices, insted **V3.8.3** uses a **runinterval** making it more **constant and controllable**.

- Developer debug shows the **logs** in the **console** like how much** time** a function has taken.

## What you can do with this?
```diff
+ you CAN use this in your pubblic addon, including database credits in the download page.
+ you CAN use this in your server, just add a credits section in it.

- you CAN'T create your shortlink to download this.
- you CAN'T pubblish this claiming it as yours.
- you CAN'T sell this to other people.
- you CAN'T pubblish custom versions without permissions.
```

## Contributes
Thanks to Drag0nD that helped me a lot in the creation of the database and gave me the structure method sending me his infinite chest addon.
https://youtu.be/Trljwe6zay8?si=Yf1gC0ZsvOyAXXEP
