 module PFM
     class Options
        # an exact copy of the initialize function, except auto run is
        # set to be on by default. Can still be turned off.
        def initialize(starting_language, game_state = PFM.game_state)
            @music_volume = 100
            @sfx_volume = 100
            @message_speed = 3
            @battle_mode = true
            @show_animation = true
            @catch_rename = true
            @language = starting_language
            @screen_scale = Graphics.window.settings[3]
            @auto_run = true
            @game_state = game_state
            self.message_frame = Configs.window.message_frame_filenames.first
        end
     end
 end