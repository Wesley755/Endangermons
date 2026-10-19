module UI
    class FieldNotesBase < GenericBase
        private
        
        # return the background filename
        # gts background is a placeholder for now
        def background_filename
            return 'gts/background'
        end

        def create_background_animation; end
    end
end