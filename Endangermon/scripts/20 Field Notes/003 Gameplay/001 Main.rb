module GamePlay
    class FieldNotes < BaseCleanUpdate::FrameBalanced
        # open the scene
        def initialize
            super
            @running = true
        end

        # Handle keyboard input each frame
        def update_inputs
            return automatic_input_update
        end

        # Update graphics each frame
        def update_graphics
            @base_ui.update_background_animation
        end

        private

        # Create all the graphics in the scene
        def create_graphics
            create_viewport
            create_base_ui
            Graphics.sort_z
        end

        # create the base UI with button texts
        def create_base_ui
            @base_ui = UI::FieldNotesBase.new(@viewport, button_texts)
        end

        # return the button texts for the ctrl buttons [A, X, Y, B]
        def button_texts
            return [nil, nil, nil, 'Quit']
        end

        # Action triggered by the B button -- quit the scene
        def action_b
            @running = false
        end
    end
end
        
GamePlay.field_notes_class = GamePlay::FieldNotes