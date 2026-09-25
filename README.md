# A C A D I A Motion Tracker

An installable offline PWA for the Haunted Village alien crash site scene.

## Running locally

Serve the `dist` folder over HTTP. Service workers do not run from a `file://` URL.

```sh
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080` on a phone connected to the same network, then install it on the Home Screen.

## Live operation

1. Confirm Sound and Vibration settings.
2. Tap **Begin Visitor Tutorial** and hand the phone to the squad leader.
3. Guide the visitors through the three tutorial screens and scanner test.
4. When the performers are ready, staff hold **Staff Hold to Go** for two seconds.
5. A three-second countdown starts the fixed ten-minute mission.
6. In an emergency, hold **Hold to abort** for about two seconds.
7. To open the hidden staff console, hold the **A.C.A.D.I.A.** wordmark for about two seconds.

Every mission uses the same ten-minute timeline, contact locations, distances, sounds, orders, and ending. The staff console can trigger Clear, One Contact, Multiple Contacts, Swarm, Black Box, Evacuate, or Reset for emergencies. A manual cue pauses the fixed timeline until staff selects **Resume Fixed Timeline**, which returns to the correct cue for the mission clock.

## Phone setup

- Install the PWA on every device before the event.
- Open each installed copy once while online so all files are cached.
- Disable notifications, calls, auto-brightness, and battery-saving restrictions where possible.
- Set media volume before each group.
- Use Guided Access on iPhone or app pinning on Android to keep visitors inside the scanner.
- Attach each phone to a rugged case and wrist strap.

The app uses synthesized tones and does not require audio files, a server, a login, GPS, Bluetooth, or an internet connection after installation.
